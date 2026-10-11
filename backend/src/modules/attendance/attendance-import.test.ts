let employeeFindMany: jest.Mock;
let attendanceFindMany: jest.Mock;
let attendanceCreateMany: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  employeeFindMany = jest.fn(async () => []);
  attendanceFindMany = jest.fn(async () => []);
  attendanceCreateMany = jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  const client = {
    employee: { findMany: employeeFindMany },
    attendance: { findMany: attendanceFindMany, createMany: attendanceCreateMany },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

import { importAttendanceHistory } from './attendance-import.service';

const csv = (body: string) =>
  ({ buffer: Buffer.from(`employeeNumber,date,status,checkIn,checkOut\n${body}`) } as Express.Multer.File);
const run = (body: string, dryRun = false) => importAttendanceHistory('c1', csv(body), { dryRun });

describe('attendance history import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindMany.mockResolvedValue([
      { id: 'e1', employeeNumber: 'EMP-001' },
      { id: 'e2', employeeNumber: 'EMP-002' },
    ]);
    attendanceFindMany.mockResolvedValue([]);
  });

  it('writes a clean file with parsed times on the row date', async () => {
    const result = await run('EMP-001,2026-09-01,PRESENT,08:01,17:03\nEMP-002,2026-09-01,ABSENT,,');

    expect(result).toMatchObject({ totalRows: 2, valid: 2, created: 2, errors: [] });
    const rows = attendanceCreateMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ employeeId: 'e1', status: 'PRESENT' });
    expect(rows[0].checkIn.toISOString()).toBe('2026-09-01T08:01:00.000Z');
    expect(rows[1]).toMatchObject({ employeeId: 'e2', status: 'ABSENT', checkIn: null });
  });

  it('writes nothing at all when one row is bad', async () => {
    const result = await run('EMP-001,2026-09-01,PRESENT,,\nEMP-999,2026-09-01,PRESENT,,');

    expect(result.created).toBe(0);
    expect(attendanceCreateMany).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatchObject({ row: 3, column: 'employeeNumber', value: 'EMP-999' });
  });

  it('reports every problem in one pass', async () => {
    const result = await run([
      'EMP-001,2026-09-01,HADIR,,',          // unknown status
      'EMP-002,01/09/2026,PRESENT,,',        // bad date
      'EMP-001,2026-09-02,PRESENT,8am,',     // bad time
      'EMP-002,2026-09-02,PRESENT,17:00,08:00', // out before in
    ].join('\n'));

    expect(result.errors.map((error) => error.column)).toEqual(['status', 'date', 'checkIn', 'checkOut']);
    expect(result.created).toBe(0);
  });

  it('refuses today and the future — history only', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await run(`EMP-001,${today},PRESENT,,`);

    expect(result.errors[0]).toMatchObject({ column: 'date', message: expect.stringContaining('lampau') });
  });

  it('refuses duplicates inside the file and clashes with stored rows', async () => {
    attendanceFindMany.mockResolvedValueOnce([{ employeeId: 'e2', date: new Date('2026-09-01T00:00:00Z') }]);

    const result = await run([
      'EMP-001,2026-09-01,PRESENT,,',
      'EMP-001,2026-09-01,LATE,,',
      'EMP-002,2026-09-01,PRESENT,,',
    ].join('\n'));

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ row: 3, message: expect.stringContaining('ganda') });
    expect(result.errors[1]).toMatchObject({ row: 4, message: expect.stringContaining('sudah punya catatan') });
    expect(result.created).toBe(0);
  });

  it('dry run validates and writes nothing even when the file is perfect', async () => {
    const result = await run('EMP-001,2026-09-01,PRESENT,08:00,17:00', true);

    expect(result).toMatchObject({ dryRun: true, valid: 1, created: 0, errors: [] });
    expect(attendanceCreateMany).not.toHaveBeenCalled();
  });
});
