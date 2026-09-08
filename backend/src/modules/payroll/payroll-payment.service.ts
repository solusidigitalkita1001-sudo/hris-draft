import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, PayrollPaymentBatchStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/shared/database/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { generateBankCsv, resolveEmployeeBankInfo } from '@/shared/payroll/disbursement';
import { createPaymentBatchSchema, paymentIdempotencyKeySchema, recordPaymentTransactionSchema } from './payroll-payment.dto';
import type { CreatePaymentBatchDTO, RecordPaymentTransactionDTO } from './payroll-payment.dto';
import { settlePayrollPaymentBatch } from './payroll-payment-settlement';

export interface PayrollPaymentContext { companyId: string; actorId: string }

type Batch = Prisma.PayrollPaymentBatchGetPayload<{ include: { transactions: true } }>;
type TransactionClient = Prisma.TransactionClient;

const contextSchema = z.object({ companyId: z.string().uuid(), actorId: z.string().uuid() });
const maxAmount = new Prisma.Decimal('9999999999999.99');

function mask(value: string | null, suffixLength = 4): string | null {
  if (!value) return null;
  return value.length > suffixLength ? `****${value.slice(-suffixLength)}` : '****';
}

function batchView(batch: Batch) {
  return {
    id: batch.id,
    runId: batch.payrollRunId,
    runName: batch.runName,
    status: batch.status,
    version: batch.version,
    totalAmount: batch.totalAmount.toFixed(2),
    transactionCount: batch.transactionCount,
    createdBy: batch.createdBy,
    runCreatedBy: batch.runCreatedBy,
    runApprovedBy: batch.runApprovedBy,
    exportedAt: batch.exportedAt?.toISOString() ?? null,
    reconciledAt: batch.reconciledAt?.toISOString() ?? null,
    cancelledAt: batch.cancelledAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    transactions: batch.transactions.map((transaction) => ({
      id: transaction.id,
      payslipId: transaction.payslipId,
      employeeId: transaction.employeeId,
      employeeName: transaction.employeeName,
      bankCode: transaction.bankCode,
      bankName: transaction.bankName,
      accountNumberMasked: mask(transaction.accountNumber),
      accountHolderMasked: transaction.accountHolder ? `${transaction.accountHolder[0]}***` : null,
      expectedAmount: transaction.expectedAmount.toFixed(2),
      paidAmount: transaction.paidAmount?.toFixed(2) ?? null,
      status: transaction.status,
      bankReferenceMasked: mask(transaction.bankReference),
      failureReason: transaction.failureReason,
      recordedAt: transaction.recordedAt?.toISOString() ?? null,
    })),
  };
}

type BatchView = ReturnType<typeof batchView>;

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

function assertContext(context: PayrollPaymentContext): void {
  if (!contextSchema.safeParse(context).success) throw new ForbiddenError('An active company and authenticated actor are required');
}

function assertRecorder(batch: Batch, context: PayrollPaymentContext): void {
  if (batch.runApprovedBy === context.actorId) {
    throw new ForbiddenError('The payroll approver cannot record or reconcile its payments');
  }
  if (!batch.runCreatedBy || !batch.runApprovedBy || batch.runCreatedBy === batch.runApprovedBy) {
    throw new ConflictError('The payroll run does not have a valid maker-checker history');
  }
}

function assertTotals(batch: Batch): void {
  const expected = batch.transactions.reduce((sum, transaction) => sum.plus(transaction.expectedAmount), new Prisma.Decimal(0));
  if (batch.transactions.length === 0 || batch.transactions.length !== batch.transactionCount || !expected.equals(batch.totalAmount)) {
    throw new ConflictError('Payment snapshot count or total does not match the payroll batch');
  }
}

/** Manual evidence ledger. These operations never submit a payment to a bank. */
export class PayrollPaymentService {
  constructor(private readonly database: PrismaClient = prisma) {}

  private async transaction<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.database.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 15000,
        });
      } catch (error) {
        if (errorCode(error) === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
  }

  private async loadBatch(tx: TransactionClient, context: PayrollPaymentContext, id: string): Promise<Batch> {
    const batch = await tx.payrollPaymentBatch.findFirst({
      where: { id, companyId: context.companyId },
      include: { transactions: { where: { companyId: context.companyId }, orderBy: { id: 'asc' } } },
    });
    if (!batch) throw new NotFoundError('Payroll payment batch not found');
    assertTotals(batch);
    return batch;
  }

  private async claimBatch(tx: TransactionClient, context: PayrollPaymentContext, id: string): Promise<Batch> {
    const batch = await this.loadBatch(tx, context, id);
    const updated = await tx.payrollPaymentBatch.updateMany({
      where: { id, companyId: context.companyId, version: batch.version, status: batch.status },
      data: { version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ConflictError('The payment batch changed; reload before retrying');
    return batch;
  }

  private async log(tx: TransactionClient, context: PayrollPaymentContext, batch: Batch, action: string, toStatus: string, transactionId?: string): Promise<void> {
    await tx.payrollPaymentLog.create({ data: {
      companyId: context.companyId,
      batchId: batch.id,
      actorId: context.actorId,
      action,
      fromStatus: batch.status,
      toStatus,
      transactionId,
    } });
  }

  private async operate(context: PayrollPaymentContext, key: string, operation: string, payload: unknown, work: (tx: TransactionClient) => Promise<BatchView>): Promise<BatchView> {
    assertContext(context);
    if (!paymentIdempotencyKeySchema.safeParse(key).success) {
      throw new BadRequestError('Idempotency-Key must be 16-128 visible ASCII characters');
    }
    const fingerprint = createHash('sha256').update(JSON.stringify({ actorId: context.actorId, operation, payload })).digest('hex');
    const replay = (previous: { fingerprint: string; result: Prisma.JsonValue }): BatchView => {
      if (previous.fingerprint !== fingerprint) throw new ConflictError('Idempotency-Key was already used with a different request');
      return previous.result as unknown as BatchView;
    };
    try {
      return await this.transaction(async (tx) => {
        const previous = await tx.payrollPaymentOperation.findFirst({ where: { companyId: context.companyId, key } });
        if (previous) return replay(previous);
        // The reservation, business changes, audit entry and replay result commit together.
        const reservation = await tx.payrollPaymentOperation.create({ data: {
          companyId: context.companyId, key, fingerprint, result: {},
        } });
        const result = await work(tx);
        await tx.payrollPaymentOperation.updateMany({
          where: { id: reservation.id, companyId: context.companyId },
          data: { result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue },
        });
        return result;
      });
    } catch (error) {
      if (errorCode(error) === 'P2002') {
        // A concurrent request can win the same key while this transaction rolls back.
        const previous = await this.database.payrollPaymentOperation.findFirst({ where: { companyId: context.companyId, key } });
        if (previous) return replay(previous);
        throw new ConflictError('A payment batch or bank reference already exists');
      }
      throw error;
    }
  }

  async createBatch(context: PayrollPaymentContext, input: CreatePaymentBatchDTO, key: string): Promise<BatchView> {
    const parsed = createPaymentBatchSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestError('A valid payroll run ID is required');
    return this.operate(context, key, 'CREATE_BATCH', parsed.data, async (tx) => {
      const existing = await tx.payrollPaymentBatch.findFirst({ where: { companyId: context.companyId, payrollRunId: parsed.data.runId } });
      if (existing) throw new ConflictError('This payroll run already has a payment batch');
      const run = await tx.payrollRun.findFirst({
        where: { id: parsed.data.runId, companyId: context.companyId, deletedAt: null },
        include: { payslips: {
          where: { companyId: context.companyId },
          include: { employee: { select: {
            id: true, companyId: true, fullName: true,
            bankName: true, bankCode: true, bankAccount: true, bankAccountHolder: true,
            bankAccounts: { where: { companyId: context.companyId, isActive: true }, orderBy: { id: 'asc' } },
          } } },
        } },
      });
      if (!run) throw new NotFoundError('Payroll run not found');
      if (run.status !== 'APPROVED' || !run.createdBy || !run.approvedBy || run.createdBy === run.approvedBy) {
        throw new ConflictError('An approved payroll run with distinct recorded creator and approver is required');
      }
      if (run.payslips.length === 0 || run.payslips.length !== run.totalEmployees) {
        throw new ConflictError('Payroll payslip count does not match the approved run');
      }
      const snapshots = run.payslips.map((payslip) => {
        if (payslip.employee.companyId !== context.companyId) throw new ConflictError('Payroll employee company does not match the batch');
        const bank = resolveEmployeeBankInfo(payslip.employee);
        if (bank.bankCode === 'UNASSIGNED' || !bank.accountNumber.trim() || !bank.accountHolder.trim()) {
          throw new ConflictError('Complete each employee bank account before creating a payment batch');
        }
        if (bank.accountNumber.length > 100 || bank.accountHolder.length > 255 || bank.bankName.length > 255) {
          throw new ConflictError('Employee bank routing exceeds the supported field lengths');
        }
        const expectedAmount = new Prisma.Decimal(payslip.netPay);
        if (!expectedAmount.isFinite() || expectedAmount.isNegative() || expectedAmount.greaterThan(maxAmount) || expectedAmount.decimalPlaces() > 2) {
          throw new ConflictError('Payroll net pay must be a nonnegative amount with at most two decimal places');
        }
        return {
          id: randomUUID(), companyId: context.companyId, payslipId: payslip.id,
          employeeId: payslip.employeeId, employeeName: payslip.employee.fullName,
          bankCode: bank.bankCode, bankName: bank.bankName,
          accountNumber: bank.accountNumber, accountHolder: bank.accountHolder,
          referenceNo: `PS-${payslip.id}-${bank.bankCode}`, expectedAmount,
        };
      });
      const totalAmount = snapshots.reduce((sum, snapshot) => sum.plus(snapshot.expectedAmount), new Prisma.Decimal(0));
      if (!totalAmount.equals(run.totalNetPay) || totalAmount.greaterThan(maxAmount)) {
        throw new ConflictError('Payroll payslip amounts do not match the approved run total');
      }
      const batch = await tx.payrollPaymentBatch.create({ data: {
        companyId: context.companyId, payrollRunId: run.id, runName: run.name,
        runCreatedBy: run.createdBy, runApprovedBy: run.approvedBy,
        totalAmount, transactionCount: snapshots.length, createdBy: context.actorId,
      } });
      await tx.payrollPaymentTransaction.createMany({ data: snapshots.map((snapshot) => ({ ...snapshot, batchId: batch.id })) });
      const snapshot = await this.loadBatch(tx, context, batch.id);
      await this.log(tx, context, snapshot, 'MANUAL_BATCH_CREATED', 'DRAFT');
      return batchView(snapshot);
    });
  }

  async getBatch(context: PayrollPaymentContext, id: string): Promise<BatchView> {
    assertContext(context);
    return this.transaction(async (tx) => batchView(await this.loadBatch(tx, context, id)));
  }

  async getBatchForRun(context: PayrollPaymentContext, runId: string): Promise<BatchView | null> {
    assertContext(context);
    return this.transaction(async (tx) => {
      const batch = await tx.payrollPaymentBatch.findFirst({ where: { companyId: context.companyId, payrollRunId: runId }, select: { id: true } });
      return batch ? batchView(await this.loadBatch(tx, context, batch.id)) : null;
    });
  }

  async exportBatch(context: PayrollPaymentContext, id: string) {
    assertContext(context);
    return this.transaction(async (tx) => {
      const batch = await this.claimBatch(tx, context, id);
      if (['CANCELLED', 'RECONCILED', 'PAID'].includes(batch.status)) throw new ConflictError('This batch has no exportable pending payments');
      const pending = batch.transactions.filter((transaction) => transaction.status !== 'PAID');
      const bankCodes = [...new Set(pending.map((transaction) => transaction.bankCode))].sort();
      const groups = bankCodes.map((bankCode) => {
        const transactions = pending.filter((transaction) => transaction.bankCode === bankCode);
        const csv = generateBankCsv(bankCode, transactions.map((transaction) => ({
          payslipId: transaction.payslipId, employeeId: transaction.employeeId, employeeName: transaction.employeeName,
          bankName: transaction.bankName, accountNumber: transaction.accountNumber, accountHolder: transaction.accountHolder,
          netPay: transaction.expectedAmount.toNumber(), referenceNo: transaction.referenceNo,
          description: `Manual payroll file ${batch.id}`,
        })), bankCode, { amountPrecision: 2 });
        return {
          bankCode, bankName: bankCode, employeeCount: transactions.length,
          totalAmount: transactions.reduce((sum, transaction) => sum.plus(transaction.expectedAmount), new Prisma.Decimal(0)).toFixed(2),
          csv: { headers: csv.headers, delimiter: csv.delimiter, filename: csv.filename, content: csv.content, totalRows: csv.totalRows },
        };
      });
      const status = batch.status === 'DRAFT' ? 'EXPORTED' : batch.status;
      await tx.payrollPaymentBatch.updateMany({ where: { id, companyId: context.companyId }, data: { status, exportedAt: batch.exportedAt ?? new Date() } });
      await this.log(tx, context, batch, 'MANUAL_BANK_FILE_EXPORTED', status);
      return { batch: batchView(await this.loadBatch(tx, context, id)), mode: 'MANUAL_BANK_FILE_EXPORT' as const, paymentSubmitted: false as const, groups };
    });
  }

  async recordTransaction(context: PayrollPaymentContext, id: string, transactionId: string, input: RecordPaymentTransactionDTO, key: string): Promise<BatchView> {
    const parsed = recordPaymentTransactionSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestError('A payment requires its exact decimal amount and bank reference; a failure requires a reason');
    return this.operate(context, key, 'RECORD_TRANSACTION', { id, transactionId, ...parsed.data }, async (tx) => {
      const batch = await this.claimBatch(tx, context, id);
      assertRecorder(batch, context);
      if (['DRAFT', 'CANCELLED', 'RECONCILED', 'PAID'].includes(batch.status)) throw new ConflictError('Export this batch before recording payment outcomes; closed batches cannot be changed');
      const transaction = batch.transactions.find((item) => item.id === transactionId);
      if (!transaction) throw new NotFoundError('Payroll payment transaction not found');
      if (transaction.status === 'PAID') throw new ConflictError('A recorded payment is immutable');
      const data = parsed.data;
      if (data.status === 'PAID' && !new Prisma.Decimal(data.amount).equals(transaction.expectedAmount)) {
        throw new ConflictError('Recorded amount does not match the immutable expected payment amount');
      }
      const updated = await tx.payrollPaymentTransaction.updateMany({
        where: { id: transactionId, batchId: id, companyId: context.companyId, status: { in: ['PENDING', 'FAILED'] } },
        data: data.status === 'PAID'
          ? { status: 'PAID', paidAmount: new Prisma.Decimal(data.amount), bankReference: data.bankReference, failureReason: null, recordedBy: context.actorId, recordedAt: new Date() }
          : { status: 'FAILED', failureReason: data.failureReason, recordedBy: context.actorId, recordedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictError('The payment transaction changed; reload before retrying');
      const fresh = await this.loadBatch(tx, context, id);
      const paid = fresh.transactions.filter((item) => item.status === 'PAID').length;
      const failed = fresh.transactions.filter((item) => item.status === 'FAILED').length;
      const status: PayrollPaymentBatchStatus = paid === fresh.transactionCount ? 'PAID'
        : failed === fresh.transactionCount ? 'FAILED'
          : failed > 0 ? 'PARTIALLY_FAILED' : 'PROCESSING';
      await tx.payrollPaymentBatch.updateMany({ where: { id, companyId: context.companyId }, data: { status } });
      await this.log(tx, context, batch, data.status === 'PAID' ? 'MANUAL_PAYMENT_RECORDED' : 'MANUAL_PAYMENT_FAILED', status, transactionId);
      return batchView(await this.loadBatch(tx, context, id));
    });
  }

  async reconcileBatch(context: PayrollPaymentContext, id: string, key: string): Promise<BatchView> {
    return this.operate(context, key, 'RECONCILE_BATCH', { id }, async (tx) => {
      const batch = await this.claimBatch(tx, context, id);
      assertRecorder(batch, context);
      if (batch.status !== 'PAID' || batch.transactions.some((transaction) =>
        transaction.status !== 'PAID' || !transaction.bankReference || !transaction.paidAmount?.equals(transaction.expectedAmount)
      )) throw new ConflictError('Every transaction must have a matching recorded payment before reconciliation');
      const paidTotal = batch.transactions.reduce((sum, transaction) => sum.plus(transaction.paidAmount ?? 0), new Prisma.Decimal(0));
      if (!paidTotal.equals(batch.totalAmount)) throw new ConflictError('Paid total does not match the immutable batch total');
      await settlePayrollPaymentBatch(tx, context, { runId: batch.payrollRunId, id: batch.id });
      await tx.payrollPaymentBatch.updateMany({ where: { id, companyId: context.companyId }, data: { status: 'RECONCILED', reconciledAt: new Date() } });
      await this.log(tx, context, batch, 'MANUAL_PAYMENTS_RECONCILED', 'RECONCILED');
      return batchView(await this.loadBatch(tx, context, id));
    });
  }

  async cancelBatch(context: PayrollPaymentContext, id: string, key: string): Promise<BatchView> {
    return this.operate(context, key, 'CANCEL_BATCH', { id }, async (tx) => {
      const batch = await this.claimBatch(tx, context, id);
      if (['CANCELLED', 'RECONCILED'].includes(batch.status) || batch.transactions.some((transaction) => transaction.status === 'PAID')) {
        throw new ConflictError('A cancelled, reconciled or paid batch cannot be cancelled');
      }
      await tx.payrollPaymentBatch.updateMany({ where: { id, companyId: context.companyId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      await this.log(tx, context, batch, 'MANUAL_BATCH_CANCELLED', 'CANCELLED');
      return batchView(await this.loadBatch(tx, context, id));
    });
  }
}

export const payrollPaymentService = new PayrollPaymentService();
