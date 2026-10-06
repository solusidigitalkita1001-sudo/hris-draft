import { buildSippWageExport, sippWageExportToCsv } from './sipp-wage-export';

/**
 * SIPP issues the template; this produces what goes INTO it. The tests pin the
 * two things that make that useful: the identifiers SIPP matches on, and
 * saying up front which rows the portal would reject.
 */
const employee = (over: Partial<Parameters<typeof buildSippWageExport>[0]['employees'][number]> = {}) => ({
  employeeNumber: 'EMP001', fullName: 'Sari Wulandari',
  nik: '3174012345670001', kpj: '1234567890',
  dateOfBirth: new Date('1995-04-17'), wage: '10000000',
  ...over,
});

const build = (over: Partial<Parameters<typeof buildSippWageExport>[0]> = {}) =>
  buildSippWageExport({ month: 9, year: 2026, employees: [employee()], ...over });

describe('the SIPP wage export', () => {
  it('carries the identifiers SIPP matches a participant on', () => {
    const row = build().rows[0];
    expect(row).toMatchObject({
      employeeNumber: 'EMP001', nik: '3174012345670001', kpj: '1234567890',
      dateOfBirth: '1995-04-17', wage: '10000000.00',
    });
    expect(row.blockers).toEqual([]);
  });

  it('writes the period as mm-yyyy', () => {
    expect(build().period).toBe('09-2026');
    expect(build({ month: 12 }).period).toBe('12-2026');
  });

  it('names what would make a row fail, before the trip to the portal', () => {
    const data = build({ employees: [
      employee({ nik: null }),
      employee({ kpj: null }),
      employee({ dateOfBirth: null }),
      employee({ wage: '0' }),
    ] });
    expect(data.rows.map((row) => row.blockers)).toEqual([
      ['NIK_MISSING'], ['KPJ_MISSING'], ['DATE_OF_BIRTH_MISSING'], ['WAGE_NOT_PAYABLE'],
    ]);
    expect(data.unusableRows).toBe(4);
    expect(data.warnings).toContain('sipp:4_ROWS_WOULD_BE_REJECTED');
  });

  it('collects every blocker on one row rather than stopping at the first', () => {
    const row = build({ employees: [employee({ nik: null, kpj: null, dateOfBirth: null })] }).rows[0];
    expect(row.blockers).toEqual(['NIK_MISSING', 'KPJ_MISSING', 'DATE_OF_BIRTH_MISSING']);
  });

  it('always says the template must come from SIPP', () => {
    // The structure is the portal's, per company. A generated file with a
    // guessed structure is what fails the upload.
    expect(build().warnings).toContain('sipp:FILL_THE_TEMPLATE_DOWNLOADED_FROM_SIPP');
    expect(build().verified).toBe(false);
  });

  it('reports an empty period rather than a silently empty file', () => {
    const data = build({ employees: [] });
    expect(data.rows).toEqual([]);
    expect(data.warnings).toContain('sipp:NO_EMPLOYEES_IN_PERIOD');
  });

  it('refuses a month the period format cannot hold', () => {
    expect(() => build({ month: 13 })).toThrow(/1\.\.12/);
    expect(() => build({ month: 0 })).toThrow();
  });

  it('tolerates a date of birth that is already a string', () => {
    expect(build({ employees: [employee({ dateOfBirth: '1990-01-31' })] }).rows[0].dateOfBirth)
      .toBe('1990-01-31');
    expect(build({ employees: [employee({ dateOfBirth: 'not a date' })] }).rows[0].blockers)
      .toContain('DATE_OF_BIRTH_MISSING');
  });
});

describe('the CSV it produces', () => {
  it('neutralises a name that a spreadsheet would execute', () => {
    // This file is opened in a spreadsheet by definition, and names are
    // tenant-supplied.
    const csv = sippWageExportToCsv(build({ employees: [employee({ fullName: '=cmd|calc' })] }));
    expect(csv).toContain("'=cmd|calc");
    expect(csv).not.toMatch(/,=cmd/);
  });

  it('quotes a name containing a comma without losing it', () => {
    const csv = sippWageExportToCsv(build({ employees: [employee({ fullName: 'Wulandari, Sari' })] }));
    expect(csv).toContain('"Wulandari, Sari"');
  });

  it('puts the blockers in the sheet, so the operator sees them beside the row', () => {
    const csv = sippWageExportToCsv(build({ employees: [employee({ kpj: null })] }));
    expect(csv).toContain('KPJ_MISSING');
  });

  it('writes one header and one line per employee', () => {
    const csv = sippWageExportToCsv(build({ employees: [employee(), employee({ employeeNumber: 'EMP002' })] }));
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv.split('\n')[0]).toContain('No KPJ');
  });
});
