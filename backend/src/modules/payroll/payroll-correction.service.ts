import { Prisma, PayrollCorrectionStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import { createPendingRegistry, groupByEmployee } from '@/shared/payroll/pending-registry';

export interface RegisterCorrectionInput {
  sourcePayslipId: string;
  amount: number;
  reason: string;
}

/**
 * Corrections — fixing a figure on a payslip that was ALREADY paid (GAP-14/21b).
 *
 * The third path the code has named twice: `voidPayrollRun` only takes a run
 * that is not yet approved, and `arrears.register` refuses when a payslip
 * exists ("a wrong amount is a correction, not arrears"). A correction is a
 * human-registered delta against a specific payslip, paid out by a CORRECTION
 * run in a later period — underpayment as an earning, overpayment as a
 * deduction that never drives the net below zero.
 */
const registry = createPendingRegistry({
  delegate: (db) => db.payrollCorrection,
  messages: {
    notFound: 'Correction entry not found',
    onlyPendingCancellable: (status) => `Only pending corrections can be cancelled; this entry is ${status}`,
    claimedWhileCancelling: 'This correction was claimed by a payroll run while you were cancelling it',
    changedWhileCalculating: 'Correction entry changed while this payroll run was calculating; re-run the calculation',
  },
});

export class PayrollCorrectionService {
  async register(companyId: string, input: RegisterCorrectionInput) {
    // Satu transaksi dengan kunci baris payslip: cek "hanya satu PENDING per
    // payslip" di bawah adalah findFirst-lalu-create, dan tanpa kunci dua
    // permintaan serentak lolos dua-duanya — koreksi yang sama dibayar dua
    // kali oleh run berikutnya. FOR UPDATE menserikan pendaftaran per payslip.
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM payslips WHERE id = ${input.sourcePayslipId} AND company_id = ${companyId} FOR UPDATE`;
      if (!locked.length) throw new NotFoundError('Payslip not found in the active company');

      return this.registerLocked(tx, companyId, input);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000 });
  }

  private async registerLocked(tx: Prisma.TransactionClient, companyId: string, input: RegisterCorrectionInput) {
    const payslip = await tx.payslip.findFirst({
      where: { id: input.sourcePayslipId, companyId },
      select: {
        id: true,
        employeeId: true,
        status: true,
        payrollRun: { select: { id: true, status: true, periodId: true } },
      },
    });
    if (!payslip) throw new NotFoundError('Payslip not found in the active company');

    // Before approval nothing has been paid, so the remedy is the existing
    // one: void the run and run it again. One problem must not have two paths.
    if (payslip.payrollRun.status === 'COMPLETED' || payslip.status !== 'FINAL') {
      throw new ConflictError(
        'This payslip is not paid money yet; void the run (PATCH /payroll/runs/:id/void) and recalculate '
        + 'instead of registering a correction',
      );
    }
    if (payslip.payrollRun.status !== 'APPROVED' && payslip.payrollRun.status !== 'DISBURSED') {
      throw new ConflictError(`A correction targets paid money; this payslip's run is ${payslip.payrollRun.status}`);
    }

    await assertEmployeeInScope(payslip.employeeId, 'payroll');

    // One live correction per payslip. A second correction of the same payslip
    // is allowed — AFTER the first is APPLIED — so the trail stays sequential.
    const pending = await tx.payrollCorrection.findFirst({
      where: { sourcePayslipId: payslip.id, status: PayrollCorrectionStatus.PENDING },
      select: { id: true },
    });
    if (pending) {
      throw new BadRequestError('A pending correction already exists for this payslip; cancel it or let a CORRECTION run apply it first');
    }

    const amount = new Prisma.Decimal(input.amount).toDecimalPlaces(2);
    // Pertahanan kedua di belakang DTO: baris 0.00 tidak akan pernah diklaim
    // run mana pun (filter klaimnya >0 / <0) dan memblokir koreksi berikutnya.
    if (amount.isZero()) {
      throw new BadRequestError('amount membulat ke nol pada dua desimal; tidak ada yang dikoreksi');
    }
    const row = await tx.payrollCorrection.create({
      data: {
        companyId,
        employeeId: payslip.employeeId,
        sourcePayslipId: payslip.id,
        amount,
        remainingAmount: amount,
        reason: input.reason,
        registeredBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('Payroll correction registered', {
      correctionId: row.id, sourcePayslipId: payslip.id, employeeId: payslip.employeeId, amount: amount.toString(),
    });
    return row;
  }

  async list(companyId: string, filters: { status?: PayrollCorrectionStatus; employeeId?: string } = {}) {
    return prisma.payrollCorrection.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { employeeNumber: true, fullName: true } },
        sourcePayslip: { select: { id: true, payrollRun: { select: { id: true, name: true, periodId: true } } } },
      },
    });
  }

  async cancel(companyId: string, id: string) {
    return registry.cancel(companyId, id);
  }

  /**
   * Pending corrections for a CORRECTION run, keyed by employee, oldest first —
   * partial overpayment coverage consumes rows in registration order. Each row
   * carries its source period so the run can refuse to pay a correction inside
   * the very period it corrects. Read inside the run's transaction.
   */
  async pendingByEmployee(companyId: string, database: Prisma.TransactionClient = prisma) {
    const rows = await database.payrollCorrection.findMany({
      where: { companyId, status: PayrollCorrectionStatus.PENDING },
      include: { sourcePayslip: { select: { payrollRun: { select: { periodId: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    return groupByEmployee(rows);
  }

  /**
   * Claim the rows a run covered IN FULL: APPLIED, trace columns filled,
   * nothing left to pay. Conditional on PENDING and counted (see
   * pending-registry): a row claimed by another run first fails the whole
   * calculation rather than paying the same correction twice.
   */
  async markApplied(
    companyId: string,
    runId: string,
    claims: Array<{ correctionId: string; payslipId: string }>,
    database: Prisma.TransactionClient = prisma,
  ) {
    await registry.markApplied(
      companyId, runId,
      claims.map((claim) => ({ id: claim.correctionId, payslipId: claim.payslipId })),
      database,
      { remainingAmount: new Prisma.Decimal(0) },
    );
  }

  /**
   * Shrink an overpayment row the run could only cover partly: the remainder
   * stays PENDING and waits for the employee's next correction earning.
   */
  async reduceRemaining(
    companyId: string,
    claims: Array<{ correctionId: string; remainingAmount: Prisma.Decimal }>,
    database: Prisma.TransactionClient = prisma,
  ) {
    for (const claim of claims) {
      const result = await database.payrollCorrection.updateMany({
        where: { id: claim.correctionId, companyId, status: PayrollCorrectionStatus.PENDING },
        data: { remainingAmount: claim.remainingAmount },
      });
      if (result.count !== 1) {
        throw new BadRequestError('Correction entry changed while this payroll run was calculating; re-run the calculation');
      }
    }
  }
}

export const payrollCorrectionService = new PayrollCorrectionService();
