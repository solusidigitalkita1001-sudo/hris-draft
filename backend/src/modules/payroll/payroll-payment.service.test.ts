jest.mock('@/shared/database/prisma', () => ({ prisma: {} }));
jest.mock('./payroll-payment-settlement', () => ({ settlePayrollPaymentBatch: jest.fn() }));
import { Prisma, PrismaClient } from '@prisma/client';
import { PayrollPaymentService } from './payroll-payment.service';
import { settlePayrollPaymentBatch } from './payroll-payment-settlement';

const companyId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const checkerId = '10000000-0000-4000-8000-000000000003';
const runId = '10000000-0000-4000-8000-000000000004';
const context = { companyId, actorId };
const key = (name: string) => `payment-test-key-${name}`;
type Batch = Prisma.PayrollPaymentBatchGetPayload<{ include: { transactions: true } }>;
type Operation = { id: string; companyId: string; key: string; fingerprint: string; result: Prisma.JsonValue };
function clone<T>(value: T): T {
  if (value instanceof Prisma.Decimal) return new Prisma.Decimal(value) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) as T;
  return value;
}
function setup() {
  let batch: Batch | null = null;
  let operations: Operation[] = [];
  let logs: unknown[] = [];
  const run = { id: runId, companyId, name: 'September', createdBy: actorId, approvedBy: checkerId,
    status: 'APPROVED', totalEmployees: 2, totalNetPay: new Prisma.Decimal('30.30'),
    payslips: [1, 2].map(number => ({ id: `payslip-${number}`, employeeId: `employee-${number}`,
      netPay: new Prisma.Decimal(number === 1 ? '10.10' : '20.20'),
      employee: { id: `employee-${number}`, companyId, fullName: `Employee ${number}`, bankCode: 'BCA',
        bankName: 'BCA', bankAccount: `123456789${number}`, bankAccountHolder: `Holder ${number}`, bankAccounts: [] },
    })),
  };
  const tx = {
    payrollRun: { findFirst: jest.fn(async ({ where }: { where: { companyId: string; id: string } }) =>
      where.companyId === companyId && where.id === run.id ? run : null) },
    payrollPaymentOperation: {
      findFirst: jest.fn(async ({ where }: { where: { companyId: string; key: string } }) => operations.find(item => item.companyId === where.companyId && item.key === where.key) ?? null),
      create: jest.fn(async ({ data }: { data: Omit<Operation, 'id'> }) => {
        const row = { ...data, id: `operation-${operations.length}` }; operations.push(row); return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { id: string }; data: { result: Prisma.JsonValue } }) => {
        Object.assign(operations.find(item => item.id === where.id)!, data); return { count: 1 };
      }),
    },
    payrollPaymentBatch: {
      findFirst: jest.fn(async ({ where }: { where: { id?: string; companyId: string; payrollRunId?: string } }) =>
        batch && batch.companyId === where.companyId && (!where.id || batch.id === where.id) && (!where.payrollRunId || batch.payrollRunId === where.payrollRunId) ? clone(batch) : null),
      create: jest.fn(async ({ data }: { data: Partial<Batch> }) => {
        batch = { id: 'batch', status: 'DRAFT', version: 0, transactions: [], exportedAt: null,
          reconciledAt: null, cancelledAt: null, createdAt: new Date(), updatedAt: new Date(), ...data } as Batch;
        return clone(batch);
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { version?: number }; data: { version?: { increment: number }; status?: Batch['status'] } }) => {
        if (!batch || (where.version !== undefined && where.version !== batch.version)) return { count: 0 };
        const { version, ...rest } = data;
        Object.assign(batch, rest);
        if (version) batch.version += version.increment;
        return { count: 1 };
      }),
    },
    payrollPaymentTransaction: {
      createMany: jest.fn(async ({ data }: { data: Partial<Batch['transactions'][number]>[] }) => {
        batch!.transactions = data.map(item => ({ status: 'PENDING', paidAmount: null, bankReference: null,
          failureReason: null, recordedAt: null, recordedBy: null, createdAt: new Date(), updatedAt: new Date(), ...item })) as Batch['transactions'];
        return { count: data.length };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Batch['transactions'][number]> }) => {
        const row = batch!.transactions.find(item => item.id === where.id)!;
        if (data.bankReference && batch!.transactions.some(item => item.bankReference === data.bankReference)) throw Object.assign(new Error('Unique reference'), { code: 'P2002' });
        Object.assign(row, data); return { count: 1 };
      }),
    },
    payrollPaymentLog: { create: jest.fn(async (data: unknown) => { logs.push(data); return data; }) },
  };
  const database = { ...tx, $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => {
    const before = clone({ batch, operations, logs });
    try { return await work(tx); } catch (error) { batch = before.batch; operations = before.operations; logs = before.logs; throw error; }
  }) };
  const service = new PayrollPaymentService(database as unknown as PrismaClient);
  async function exported() { const created = await service.createBatch(context, { runId }, key('create')); return service.exportBatch(context, created.id); }
  async function paid() {
    const data = await exported();
    for (const transaction of data.batch.transactions) await service.recordTransaction(context, data.batch.id, transaction.id,
      { status: 'PAID', amount: transaction.expectedAmount, bankReference: `bank-${transaction.id}` }, key(transaction.id));
    return service.getBatch(context, data.batch.id);
  }
  return { service, tx, run, exported, paid, state: () => clone({ batch, operations, logs }) };
}

describe('manual payroll payment ledger', () => {
  beforeEach(() => jest.resetAllMocks());
  it('freezes bank routing and exact amounts; public views and audit omit full routing', async () => {
    const fixture = setup();
    const created = await fixture.service.createBatch(context, { runId }, key('create'));
    expect(JSON.stringify(created)).not.toContain('1234567891');
    fixture.run.payslips[0].employee.bankAccount = 'CHANGED';
    const exported = await fixture.service.exportBatch(context, created.id);
    expect(exported.paymentSubmitted).toBe(false);
    expect(exported.batch.status).toBe('EXPORTED');
    expect(exported.groups[0].csv.content).toContain('1234567891');
    expect(exported.groups[0].csv.content).toContain('10.10');
    expect(exported.groups[0].csv.content).not.toContain('CHANGED');
    expect(JSON.stringify(fixture.state().logs)).not.toContain('1234567891');
    expect(settlePayrollPaymentBatch).not.toHaveBeenCalled();
  });
  it('replays the same creation key once and rejects changed payload or actor', async () => {
    const fixture = setup();
    const created = await fixture.service.createBatch(context, { runId }, key('create'));
    expect(await fixture.service.createBatch(context, { runId }, key('create'))).toEqual(created);
    await expect(fixture.service.createBatch({ companyId, actorId: checkerId }, { runId }, key('create'))).rejects.toThrow('different request');
    expect(fixture.state().logs).toHaveLength(1);
    expect(fixture.tx.payrollPaymentTransaction.createMany).toHaveBeenCalledTimes(1);
  });
  it('rejects duplicate batches even with a new key', async () => {
    const fixture = setup(); await fixture.exported();
    await expect(fixture.service.createBatch(context, { runId }, key('second'))).rejects.toThrow('already has');
    expect(fixture.state().operations).toHaveLength(1);
  });
  it('requires export and a recorder distinct from the payroll checker', async () => {
    const fixture = setup(); const batch = await fixture.service.createBatch(context, { runId }, key('create'));
    const data = { status: 'PAID' as const, amount: '10.10', bankReference: 'reference' };
    await expect(fixture.service.recordTransaction(context, batch.id, batch.transactions[0].id, data, key('record'))).rejects.toThrow('Export');
    await fixture.service.exportBatch(context, batch.id);
    await expect(fixture.service.recordTransaction({ companyId, actorId: checkerId }, batch.id, batch.transactions[0].id, data, key('record'))).rejects.toThrow('approver');
  });
  it('rejects amount mismatch without committing key, state or audit', async () => {
    const fixture = setup(); const { batch } = await fixture.exported(); const before = fixture.state();
    await expect(fixture.service.recordTransaction(context, batch.id, batch.transactions[0].id,
      { status: 'PAID', amount: '10.11', bankReference: 'reference' }, key('record'))).rejects.toThrow('does not match');
    expect(fixture.state()).toEqual(before);
  });
  it('tracks partial failure, retries only unpaid entries, then reconciles atomically and replays', async () => {
    const fixture = setup(); const { batch } = await fixture.exported(); const [one, two] = batch.transactions;
    await fixture.service.recordTransaction(context, batch.id, one.id, { status: 'PAID', amount: one.expectedAmount, bankReference: 'ref-one' }, key('one'));
    const partial = await fixture.service.recordTransaction(context, batch.id, two.id, { status: 'FAILED', failureReason: 'Bank rejected' }, key('two-fail'));
    expect(partial.status).toBe('PARTIALLY_FAILED');
    const retryFile = await fixture.service.exportBatch(context, batch.id);
    expect(retryFile.groups[0].employeeCount).toBe(1);
    expect(retryFile.groups[0].csv.content).not.toContain(one.employeeName);
    await expect(fixture.service.reconcileBatch(context, batch.id, key('reconcile'))).rejects.toThrow('Every transaction');
    await fixture.service.recordTransaction(context, batch.id, two.id, { status: 'PAID', amount: two.expectedAmount, bankReference: 'ref-two' }, key('two-paid'));
    const reconciled = await fixture.service.reconcileBatch(context, batch.id, key('reconcile'));
    expect(reconciled.status).toBe('RECONCILED');
    expect(await fixture.service.reconcileBatch(context, batch.id, key('reconcile'))).toEqual(reconciled);
    expect(settlePayrollPaymentBatch).toHaveBeenCalledTimes(1);
    expect(settlePayrollPaymentBatch).toHaveBeenCalledWith(fixture.tx, context, { runId, id: batch.id });
  });
  it('cannot reuse bank references or edit paid entries', async () => {
    const fixture = setup(); const { batch } = await fixture.exported(); const [one, two] = batch.transactions;
    const data = { status: 'PAID' as const, amount: one.expectedAmount, bankReference: 'same-reference' };
    await fixture.service.recordTransaction(context, batch.id, one.id, data, key('one'));
    await expect(fixture.service.recordTransaction(context, batch.id, one.id, data, key('edit'))).rejects.toThrow('immutable');
    await expect(fixture.service.recordTransaction(context, batch.id, two.id, { ...data, amount: two.expectedAmount }, key('two'))).rejects.toThrow('already exists');
    expect(fixture.state().batch!.transactions.find(item => item.id === two.id)!.status).toBe('PENDING');
  });
  it('rolls back reconciliation and idempotency reservation if loan settlement fails', async () => {
    const fixture = setup(); const batch = await fixture.paid(); const before = fixture.state();
    jest.mocked(settlePayrollPaymentBatch).mockRejectedValueOnce(new Error('Loan already paid'));
    await expect(fixture.service.reconcileBatch(context, batch.id, key('reconcile'))).rejects.toThrow('Loan already paid');
    expect(fixture.state()).toEqual(before);
    expect((await fixture.service.reconcileBatch(context, batch.id, key('reconcile'))).status).toBe('RECONCILED');
  });
  it('rejects another company before returning payment metadata', async () => {
    const fixture = setup(); const { batch } = await fixture.exported();
    await expect(fixture.service.getBatch({ companyId: checkerId, actorId }, batch.id)).rejects.toThrow('not found');
  });
  it('allows cancellation only before any recorded payment', async () => {
    const fixture = setup(); const batch = await fixture.paid();
    await expect(fixture.service.cancelBatch(context, batch.id, key('cancel'))).rejects.toThrow('cannot be cancelled');
    const fresh = setup(); const created = await fresh.service.createBatch(context, { runId }, key('create'));
    expect((await fresh.service.cancelBatch(context, created.id, key('cancel'))).status).toBe('CANCELLED');
    await expect(fresh.service.exportBatch(context, created.id)).rejects.toThrow('no exportable');
  });
});
