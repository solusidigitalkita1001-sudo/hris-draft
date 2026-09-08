jest.mock('@/shared/database/prisma', () => ({ prisma: {} }));
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PayrollPaymentService } from './payroll-payment.service';

const databaseUrl = process.env.PAYROLL_PAYMENT_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;

withDatabase('payroll payment ledger (isolated real MySQL)', () => {
  let database: PrismaClient;
  let service: PayrollPaymentService;
  const companies: string[] = [];
  const groups: string[] = [];
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Payment integration tests require an isolated local hris_payment_integration database');
    }
    database = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    service = new PayrollPaymentService(database);
    await database.$connect();
  });
  afterAll(async () => {
    if (!database) return;
    const companyId = { in: companies };
    try {
      await database.payrollPaymentLog.deleteMany({ where: { companyId } });
      await database.payrollPaymentOperation.deleteMany({ where: { companyId } });
      await database.payrollPaymentTransaction.deleteMany({ where: { companyId } });
      await database.payrollPaymentBatch.deleteMany({ where: { companyId } });
      await database.payrollLoanDeductionSnapshot.deleteMany({ where: { companyId } });
      await database.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await database.payslip.deleteMany({ where: { companyId } });
      await database.payrollRun.deleteMany({ where: { companyId } });
      await database.payrollPeriod.deleteMany({ where: { companyId } });
      await database.loanInstallment.deleteMany({ where: { loan: { companyId } } });
      await database.loan.deleteMany({ where: { companyId } });
      await database.loanType.deleteMany({ where: { companyId } });
      await database.salaryComponent.deleteMany({ where: { companyId } });
      await database.employee.deleteMany({ where: { companyId } });
      await database.company.deleteMany({ where: { id: companyId } });
      await database.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await database.$disconnect(); }
  });
  async function fixture() {
    const groupId = randomUUID(), companyId = randomUUID(), maker = randomUUID(), checker = randomUUID();
    groups.push(groupId); companies.push(companyId);
    await database.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Payment integration' } });
    await database.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic payroll only' } });
    const employee = await database.employee.create({ data: { companyId, employeeNumber: randomUUID(),
      firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee', bankName: 'BCA', bankCode: 'BCA',
      bankAccount: '1234567890', bankAccountHolder: 'Synthetic Employee' } });
    const period = await database.payrollPeriod.create({ data: { companyId, name: 'Test', code: randomUUID(),
      startDate: new Date('2026-09-01'), endDate: new Date('2026-09-30'), payDate: new Date('2026-09-30') } });
    const run = await database.payrollRun.create({ data: { companyId, periodId: period.id, name: 'Test payroll', runNumber: 1,
      status: 'APPROVED', createdBy: maker, approvedBy: checker, totalEmployees: 1, totalEarnings: '100.00', totalDeductions: '30.30', totalNetPay: '69.70' } });
    const component = await database.salaryComponent.create({ data: { companyId, code: 'LOAN_DEDUCTION_AUTO', name: 'Loan', type: 'DEDUCTION' } });
    const payslip = await database.payslip.create({ data: { payrollRunId: run.id, companyId, employeeId: employee.id,
      baseSalary: '100.00', totalEarnings: '100.00', totalDeductions: '30.30', netPay: '69.70',
      components: { create: { salaryComponentId: component.id, name: 'Loan', type: 'DEDUCTION', amount: '30.30' } } } });
    const loanType = await database.loanType.create({ data: { companyId, name: 'Test loan', maxAmount: 100 } });
    const loan = await database.loan.create({ data: { companyId, employeeId: employee.id, loanTypeId: loanType.id,
      amount: '60.60', installmentAmount: '30.30', totalInstallments: 2, remainingBalance: '60.60', status: 'ACTIVE', reason: 'Test fixture' } });
    const installment = await database.loanInstallment.create({ data: { loanId: loan.id, amount: '30.30', dueDate: new Date('2026-09-01') } });
    // This additional due installment is deliberately absent from the frozen slip.
    const otherInstallment = await database.loanInstallment.create({ data: { loanId: loan.id, amount: '30.30', dueDate: new Date('2026-09-02') } });
    await database.payrollLoanDeductionSnapshot.create({ data: { companyId, runId: run.id, payslipId: payslip.id, loanId: loan.id, installmentId: installment.id, amount: '30.30' } });
    return { context: { companyId, actorId: maker }, run, installment, otherInstallment, loan };
  }
  async function ready(f: Awaited<ReturnType<typeof fixture>>) {
    const batch = await service.createBatch(f.context, { runId: f.run.id }, randomUUID());
    await service.exportBatch(f.context, batch.id);
    return batch;
  }
  it('serializes duplicate create/payment/reconciliation and deducts the frozen loan once', async () => {
    const f = await fixture(); const createKey = randomUUID();
    const created = await Promise.all([1, 2].map(() => service.createBatch(f.context, { runId: f.run.id }, createKey)));
    expect(created[0].id).toBe(created[1].id);
    const batch = created[0]; await service.exportBatch(f.context, batch.id);
    const paymentKey = randomUUID();
    const data = { status: 'PAID' as const, amount: '69.70', bankReference: randomUUID() };
    await Promise.all([1, 2].map(() => service.recordTransaction(f.context, batch.id, batch.transactions[0].id, data, paymentKey)));
    const results = await Promise.allSettled([1, 2].map(() => service.reconcileBatch(f.context, batch.id, randomUUID())));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await database.payrollRun.findUniqueOrThrow({ where: { id: f.run.id } })).status).toBe('DISBURSED');
    expect((await database.loan.findUniqueOrThrow({ where: { id: f.loan.id } })).remainingBalance.toFixed(2)).toBe('30.30');
    expect((await database.loanInstallment.findUniqueOrThrow({ where: { id: f.otherInstallment.id } })).status).toBe('PENDING');
    expect(await database.payrollPaymentLog.count({ where: { batchId: batch.id, action: 'MANUAL_PAYMENTS_RECONCILED' } })).toBe(1);
  }, 30000);
  it('rolls back payroll status, ledger version, key and audit when a frozen installment was already paid', async () => {
    const f = await fixture(); const batch = await ready(f);
    await service.recordTransaction(f.context, batch.id, batch.transactions[0].id,
      { status: 'PAID', amount: '69.70', bankReference: randomUUID() }, randomUUID());
    await database.loanInstallment.update({ where: { id: f.installment.id }, data: { status: 'PAID' } });
    const before = await database.payrollPaymentBatch.findUniqueOrThrow({ where: { id: batch.id } });
    const reconcileKey = randomUUID();
    await expect(service.reconcileBatch(f.context, batch.id, reconcileKey)).rejects.toThrow('already paid');
    expect(await database.payrollPaymentBatch.findUniqueOrThrow({ where: { id: batch.id } })).toEqual(before);
    expect((await database.payrollRun.findUniqueOrThrow({ where: { id: f.run.id } })).status).toBe('APPROVED');
    expect(await database.payrollPaymentOperation.count({ where: { companyId: f.context.companyId, key: reconcileKey } })).toBe(0);
    expect(await database.payrollPaymentLog.count({ where: { batchId: batch.id, action: 'MANUAL_PAYMENTS_RECONCILED' } })).toBe(0);
  }, 30000);
  it('rejects amount mismatch and foreign tenant without changing the batch', async () => {
    const f = await fixture(); const batch = await ready(f);
    await expect(service.recordTransaction(f.context, batch.id, batch.transactions[0].id,
      { status: 'PAID', amount: '69.71', bankReference: randomUUID() }, randomUUID())).rejects.toThrow('does not match');
    await expect(service.getBatch({ ...f.context, companyId: randomUUID() }, batch.id)).rejects.toThrow('not found');
    expect((await service.getBatch(f.context, batch.id)).status).toBe('EXPORTED');
  }, 30000);
});
