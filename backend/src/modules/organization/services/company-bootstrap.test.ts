import { Prisma } from '@prisma/client';
import { bootstrapCompany, DEFAULT_LEAVE_TYPES, DEFAULT_SALARY_COMPONENTS } from './company-bootstrap.service';

jest.mock('@/shared/logger/WinstonLogger', () => ({
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

/**
 * A fake that enforces the one rule the real composite unique key enforces:
 * a (companyId, code) pair exists at most once. That is enough to tell an
 * idempotent bootstrap apart from one that duplicates or overwrites.
 */
function fakeDb(seed: { leaveTypes?: Array<{ companyId: string; code: string; name: string }>;
  components?: Array<{ companyId: string; code: string; name: string }> } = {}) {
  const leaveTypes = [...(seed.leaveTypes ?? [])];
  const components = [...(seed.components ?? [])];
  const table = <T extends { companyId: string; code: string }>(rows: T[]) => ({
    findUnique: async ({ where }: { where: { companyId_code: { companyId: string; code: string } } }) =>
      rows.find(row => row.companyId === where.companyId_code.companyId && row.code === where.companyId_code.code) ?? null,
    create: async ({ data }: { data: T }) => { rows.push(data); return data; },
  });
  return {
    db: {
      company: { findFirst: async () => ({ id: 'company-1' }) },
      leaveType: table(leaveTypes),
      salaryComponent: table(components),
    } as unknown as Prisma.TransactionClient,
    leaveTypes,
    components,
  };
}

describe('bootstrapping a new company', () => {
  it('gives it a usable leave catalogue and the payroll components the engine resolves by code', async () => {
    const { db, leaveTypes, components } = fakeDb();
    const summary = await bootstrapCompany('company-1', db);

    expect(summary.leaveTypesCreated).toBe(DEFAULT_LEAVE_TYPES.length);
    expect(summary.salaryComponentsCreated).toBe(DEFAULT_SALARY_COMPONENTS.length);

    // Without PPH21 the payroll engine withholds no tax at all, which is also
    // what makes the gross-up setting silently do nothing. The other three are
    // the remaining codes employee-pay.ts resolves by name.
    expect(components.map(row => row.code).sort()).toEqual(['BPJS-KES', 'BPJS-TK', 'GP', 'PPH21']);
    expect(leaveTypes.map(row => row.code)).toContain('ANNUAL');
    expect(leaveTypes.map(row => row.code)).toContain('UNPAID');
    expect(leaveTypes).toHaveLength(DEFAULT_LEAVE_TYPES.length);
  });

  it('is safe to run twice and never overwrites what the tenant renamed', async () => {
    const { db, leaveTypes, components } = fakeDb({
      leaveTypes: [{ companyId: 'company-1', code: 'ANNUAL', name: 'Cuti Tahunan (kebijakan kami)' }],
    });

    const first = await bootstrapCompany('company-1', db);
    expect(first.leaveTypesExisting).toBe(1);
    expect(first.leaveTypesCreated).toBe(DEFAULT_LEAVE_TYPES.length - 1);

    const second = await bootstrapCompany('company-1', db);
    expect(second.leaveTypesCreated).toBe(0);
    expect(second.salaryComponentsCreated).toBe(0);
    expect(second.leaveTypesExisting).toBe(DEFAULT_LEAVE_TYPES.length);

    // No duplicates, and the tenant's own name survived both passes.
    expect(leaveTypes).toHaveLength(DEFAULT_LEAVE_TYPES.length);
    expect(components).toHaveLength(DEFAULT_SALARY_COMPONENTS.length);
    expect(leaveTypes.find(row => row.code === 'ANNUAL')?.name).toBe('Cuti Tahunan (kebijakan kami)');
  });

  it('seeds per company, so a second tenant gets its own ANNUAL', async () => {
    const { db, leaveTypes } = fakeDb({
      leaveTypes: DEFAULT_LEAVE_TYPES.map(type => ({ companyId: 'company-0', code: type.code, name: type.name })),
    });
    const summary = await bootstrapCompany('company-1', db);
    expect(summary.leaveTypesCreated).toBe(DEFAULT_LEAVE_TYPES.length);
    expect(leaveTypes.filter(row => row.code === 'ANNUAL')).toHaveLength(2);
  });
});
