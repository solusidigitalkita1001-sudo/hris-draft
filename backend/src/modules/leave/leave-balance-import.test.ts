let employeeFindMany: jest.Mock;
let leaveTypeFindMany: jest.Mock;
let balanceFindMany: jest.Mock;
let balanceCreateMany: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  employeeFindMany = jest.fn(async () => []);
  leaveTypeFindMany = jest.fn(async () => []);
  balanceFindMany = jest.fn(async () => []);
  balanceCreateMany = jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  const client = {
    employee: { findMany: employeeFindMany },
    leaveType: { findMany: leaveTypeFindMany },
    leaveBalance: { findMany: balanceFindMany, createMany: balanceCreateMany },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

import { importOpeningLeaveBalances } from './leave-balance-import.service';

const csv = (body: string) =>
  ({ buffer: Buffer.from(`employeeNumber,leaveTypeCode,year,totalDays,usedDays,carryOverDays\n${body}`) } as Express.Multer.File);
const run = (body: string, dryRun = false) => importOpeningLeaveBalances('c1', csv(body), { dryRun });

describe('opening leave balance import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindMany.mockResolvedValue([{ id: 'e1', employeeNumber: 'EMP-001' }]);
    leaveTypeFindMany.mockResolvedValue([{ id: 'lt1', code: 'ANNUAL' }]);
    balanceFindMany.mockResolvedValue([]);
  });

  it('writes a clean file and derives the remaining days', async () => {
    const result = await run('EMP-001,ANNUAL,2026,12,3,2');

    expect(result).toMatchObject({ totalRows: 1, valid: 1, created: 1, errors: [] });
    expect(balanceCreateMany.mock.calls[0][0].data[0]).toMatchObject({
      employeeId: 'e1', leaveTypeId: 'lt1', year: 2026,
      totalDays: 12, usedDays: 3, carryOverDays: 2, remainingDays: 11,
    });
  });

  it('defaults used and carry-over to zero', async () => {
    const file = { buffer: Buffer.from('employeeNumber,leaveTypeCode,year,totalDays\nEMP-001,ANNUAL,2026,12') } as Express.Multer.File;
    const result = await importOpeningLeaveBalances('c1', file);

    expect(result.errors).toEqual([]);
    expect(balanceCreateMany.mock.calls[0][0].data[0]).toMatchObject({ usedDays: 0, carryOverDays: 0, remainingDays: 12 });
  });

  it('reports every problem in one pass and writes nothing', async () => {
    const result = await run([
      'EMP-999,ANNUAL,2026,12,0,0',   // unknown employee
      'EMP-001,SICK,2026,12,0,0',     // unknown leave type
      'EMP-001,ANNUAL,abc,12,0,0',    // bad year
      'EMP-001,ANNUAL,2026,12,99,0',  // negative remainder
    ].join('\n'));

    expect(result.errors.map((error) => error.column)).toEqual(['employeeNumber', 'leaveTypeCode', 'year', 'usedDays']);
    expect(result.created).toBe(0);
    expect(balanceCreateMany).not.toHaveBeenCalled();
  });

  it('refuses duplicates in the file and balances already stored', async () => {
    balanceFindMany.mockResolvedValueOnce([{ employeeId: 'e1', leaveTypeId: 'lt1', year: 2025 }]);

    const result = await run([
      'EMP-001,ANNUAL,2026,12,0,0',
      'EMP-001,ANNUAL,2026,10,0,0',
      'EMP-001,ANNUAL,2025,12,0,0',
    ].join('\n'));

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ row: 3, message: expect.stringContaining('ganda') });
    expect(result.errors[1]).toMatchObject({ row: 4, message: expect.stringContaining('sudah punya saldo') });
  });

  it('dry run validates and writes nothing', async () => {
    const result = await run('EMP-001,ANNUAL,2026,12,0,0', true);

    expect(result).toMatchObject({ dryRun: true, valid: 1, created: 0 });
    expect(balanceCreateMany).not.toHaveBeenCalled();
  });
});
