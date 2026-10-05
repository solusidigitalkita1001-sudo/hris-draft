let employeeFindMany: jest.Mock;
let salaryFindMany: jest.Mock;
let salaryCreate: jest.Mock;
let salaryUpdateMany: jest.Mock;
let transaction: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  employeeFindMany = jest.fn(async () => []);
  salaryFindMany = jest.fn(async () => []);
  salaryCreate = jest.fn(async ({ data }: { data: unknown }) => data);
  salaryUpdateMany = jest.fn(async () => ({ count: 1 }));
  // Defined in two steps: letting $transaction close over `client` inside the
  // same literal makes its type circular.
  const client: Record<string, unknown> = {
    employee: { findMany: employeeFindMany },
    employeeSalary: { findMany: salaryFindMany, create: salaryCreate, updateMany: salaryUpdateMany },
  };
  transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
  client.$transaction = transaction;
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

import { importSalaryMaster } from './salary-import.service';

const csv = (body: string) =>
  ({ buffer: Buffer.from(`employeeNumber,baseSalary,effectiveDate\n${body}`) } as Express.Multer.File);
const run = (body: string, dryRun = false) => importSalaryMaster('c1', csv(body), { dryRun });

describe('salary master import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindMany.mockResolvedValue([
      { id: 'e1', employeeNumber: 'EMP-001' },
      { id: 'e2', employeeNumber: 'EMP-002' },
    ]);
    salaryFindMany.mockResolvedValue([]);
  });

  it('writes a clean file and supersedes the earlier active row', async () => {
    const result = await run('EMP-001,10000000,2026-01-01\nEMP-002,8500000,2026-01-01');

    expect(result).toMatchObject({ totalRows: 2, valid: 2, created: 2, errors: [] });
    expect(salaryUpdateMany).toHaveBeenCalledTimes(2);
    expect(salaryCreate.mock.calls[0][0].data).toMatchObject({ employeeId: 'e1', isActive: true });
  });

  it('writes nothing at all when one row is bad', async () => {
    const result = await run('EMP-001,10000000,2026-01-01\nEMP-999,8500000,2026-01-01');

    // A half-imported salary master is worse than none, because the half that
    // landed gets paid.
    expect(result.created).toBe(0);
    expect(salaryCreate).not.toHaveBeenCalled();
    expect(result.errors).toEqual([
      { row: 3, column: 'employeeNumber', value: 'EMP-999', message: expect.stringContaining('tidak ditemukan') },
    ]);
  });

  it('reports every problem in one pass rather than stopping at the first', async () => {
    const result = await run([
      'EMP-001,abc,2026-01-01',
      'EMP-002,8500000,01/02/2026',
      ',5000000,2026-01-01',
    ].join('\n'));

    expect(result.errors.map((error) => error.column)).toEqual(['baseSalary', 'effectiveDate', 'employeeNumber']);
    expect(result.created).toBe(0);
  });

  it('dry run validates and writes nothing even when the file is perfect', async () => {
    const result = await run('EMP-001,10000000,2026-01-01', true);

    expect(result).toMatchObject({ dryRun: true, valid: 1, created: 0, errors: [] });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses a duplicate employee and date inside the same file', async () => {
    const result = await run('EMP-001,10000000,2026-01-01\nEMP-001,11000000,2026-01-01');

    expect(result.errors[0]).toMatchObject({ row: 3, message: expect.stringContaining('ganda') });
  });

  it('refuses a row that clashes with a salary already stored', async () => {
    salaryFindMany.mockResolvedValueOnce([{ employeeId: 'e1', effectiveDate: new Date('2026-01-01T00:00:00Z') }]);

    const result = await run('EMP-001,10000000,2026-01-01');

    expect(result.errors[0]).toMatchObject({ column: 'effectiveDate' });
    expect(result.created).toBe(0);
  });

  it('refuses a non-IDR row rather than importing pay that can never run', async () => {
    const file = { buffer: Buffer.from('employeeNumber,baseSalary,effectiveDate,currency\nEMP-001,10000000,2026-01-01,USD') } as Express.Multer.File;

    const result = await importSalaryMaster('c1', file);

    expect(result.errors[0]).toMatchObject({ column: 'currency', value: 'USD' });
  });

  it('refuses a figure too large for the column instead of truncating it', async () => {
    const result = await run('EMP-001,99999999999999999,2026-01-01');

    expect(result.errors[0]).toMatchObject({ column: 'baseSalary', message: expect.stringContaining('batas kolom') });
  });

  it('accepts Indonesian thousand separators', async () => {
    const result = await run('EMP-001,10.000.000,2026-01-01');

    expect(result.errors).toEqual([]);
    expect(String(salaryCreate.mock.calls[0][0].data.baseSalary)).toBe('10000000');
  });
});
