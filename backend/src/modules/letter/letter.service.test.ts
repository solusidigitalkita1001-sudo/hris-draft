let templateFindFirst: jest.Mock;
let templateFindMany: jest.Mock;
let templateUpsert: jest.Mock;
let employeeFindFirst: jest.Mock;
/** Flipped per test; simpler than reaching through globalThis. */
let sensitiveReadable = true;

jest.mock('@/shared/database/prisma', () => {
  templateFindFirst = jest.fn();
  templateFindMany = jest.fn(async () => []);
  templateUpsert = jest.fn(async (args: { create?: Record<string, unknown>; update?: Record<string, unknown> }) =>
    ({ ...(args.create ?? args.update ?? {}) }));
  employeeFindFirst = jest.fn();
  const client = {
    letterTemplate: { findFirst: templateFindFirst, findMany: templateFindMany, upsert: templateUpsert, update: jest.fn() },
    employee: { findFirst: employeeFindFirst },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));
jest.mock('@/modules/employee/employee-pii', () => ({
  serializeEmployee: (row: Record<string, unknown> | null) => {
    if (!row || sensitiveReadable) return row;
    const masked = { ...row };
    for (const field of ['idNumber', 'taxId']) {
      if (masked[field] != null) {
        const value = String(masked[field]);
        masked[field] = value.length <= 4 ? '****' : '*'.repeat(value.length - 4) + value.slice(-4);
      }
    }
    return masked;
  },
}));

import { letterService } from './letter.service';

const employee = {
  fullName: 'Siti Rahayu', employeeNumber: 'EMP-001', email: 's@contoh.id',
  joinDate: new Date('2021-03-01T00:00:00Z'), employmentType: 'PERMANENT',
  idNumber: '3201234567890001', taxId: '091234567890000',
  placeOfBirth: 'Bandung', dateOfBirth: new Date('1995-07-12T00:00:00Z'),
  position: { name: 'Staf Keuangan' }, department: { name: 'Keuangan' },
  company: { name: 'PT Contoh', address: 'Jl. Merdeka 1' },
};

describe('letter template service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sensitiveReadable = true;
    employeeFindFirst.mockResolvedValue(employee);
  });

  it('refuses to save a template naming a placeholder it cannot fill', async () => {
    await expect(letterService.upsert('c1', { code: 'SK', name: 'SK', body: 'Halo {{employee.gaji}}' }))
      .rejects.toThrow(/employee\.gaji/);
    // Refused at save, not at render: a letter with a silent hole gets signed.
    expect(templateUpsert).not.toHaveBeenCalled();
  });

  it('renders the employee into the body', async () => {
    templateFindFirst.mockResolvedValueOnce({
      id: 't1', code: 'SKK', name: 'Surat Keterangan Kerja', isActive: true,
      body: '{{company.name}} menerangkan {{employee.fullName}} ({{employee.employeeNumber}}) sebagai {{employee.position}}.',
    });

    const result = await letterService.render('c1', 't1', { employeeId: 'e1' });

    expect(result.rendered).toBe('PT Contoh menerangkan Siti Rahayu (EMP-001) sebagai Staf Keuangan.');
    expect(result.placeholdersUsed).toContain('employee.position');
  });

  it('refuses to render an inactive template', async () => {
    templateFindFirst.mockResolvedValueOnce({ id: 't1', code: 'X', name: 'X', isActive: false, body: 'x' });

    await expect(letterService.render('c1', 't1', { employeeId: 'e1' })).rejects.toThrow(/tidak aktif/i);
  });

  it('masks NIK and NPWP when the requester may not read them raw', async () => {
    sensitiveReadable = false;
    templateFindFirst.mockResolvedValueOnce({
      id: 't1', code: 'SKK', name: 'SKK', isActive: true,
      body: 'NIK {{employee.idNumber}} NPWP {{employee.taxId}}',
    });

    const result = await letterService.render('c1', 't1', { employeeId: 'e1' });

    // A letter is not a loophole around employee:read-sensitive.
    expect(result.rendered).toBe('NIK ************0001 NPWP ***********0000');
    expect(result.rendered).not.toContain('3201234567890001');
  });

  it('renders NIK raw for a requester who may read it', async () => {
    templateFindFirst.mockResolvedValueOnce({
      id: 't1', code: 'SKK', name: 'SKK', isActive: true, body: '{{employee.idNumber}}',
    });

    expect((await letterService.render('c1', 't1', { employeeId: 'e1' })).rendered).toBe('3201234567890001');
  });

  it('refuses an employee outside the company', async () => {
    templateFindFirst.mockResolvedValueOnce({ id: 't1', code: 'X', name: 'X', isActive: true, body: 'x' });
    employeeFindFirst.mockResolvedValueOnce(null);

    await expect(letterService.render('c1', 't1', { employeeId: 'other' })).rejects.toThrow(/tidak ditemukan/i);
  });
});
