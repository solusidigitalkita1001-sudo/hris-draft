import { buildPayrollJournal, journalToCsv, type JournalPayslip } from './journal';

const slip = (over: Partial<JournalPayslip> & { departmentId?: string | null } = {}): JournalPayslip => ({
  netPay: 7_500_000,
  // `?? 'd1'` would turn an explicit null back into a department and make
  // the no-department case assert nothing.
  employeeSnapshot: { departmentId: 'departmentId' in over ? over.departmentId : 'd1', departmentName: 'Produksi' },
  components: [
    { name: 'Gaji Pokok', type: 'ALLOWANCE', amount: 10_000_000 },
    { name: 'PPh 21', type: 'DEDUCTION', amount: 1_500_000 },
    { name: 'BPJS Kesehatan', type: 'DEDUCTION', amount: 1_000_000 },
  ],
  ...over,
});
const centres = new Map<string, string | null>([['d1', 'CC-100'], ['d2', null]]);

describe('payroll journal by cost centre', () => {
  it('balances: earnings equal deductions plus net pay', () => {
    const [line] = buildPayrollJournal([slip(), slip()], centres);

    expect(line.earnings).toBe(20_000_000);
    expect(line.deductionsTotal).toBe(5_000_000);
    expect(line.netPay).toBe(15_000_000);
    // The assertion that makes this journal postable rather than decorative.
    expect(line.imbalance).toBe(0);
  });

  it('breaks deductions out by component instead of one lump', () => {
    const [line] = buildPayrollJournal([slip()], centres);

    expect(line.deductions).toEqual([
      { name: 'PPh 21', amount: 1_500_000 },
      { name: 'BPJS Kesehatan', amount: 1_000_000 },
    ]);
  });

  it('resolves the cost centre from the frozen department, and groups by it', () => {
    const other = slip({ departmentId: 'dX' });
    (other.employeeSnapshot as { departmentName: string }).departmentName = 'Gudang';
    const lines = buildPayrollJournal([slip(), other], new Map([['d1', 'CC-100'], ['dX', 'CC-200']]));

    expect(lines.map((line) => line.costCenter).sort()).toEqual(['CC-100', 'CC-200']);
    expect(lines.every((line) => line.imbalance === 0)).toBe(true);
  });

  it('reports a department with no cost centre as UNASSIGNED rather than dropping it', () => {
    const [line] = buildPayrollJournal([slip({ departmentId: 'd2' })], centres);

    // A line accounting cannot post is a question to answer; a missing line is
    // money that silently left the journal.
    expect(line.costCenter).toBe('UNASSIGNED');
    expect(line.earnings).toBe(10_000_000);
  });

  it('reports an employee with no department at all', () => {
    const [line] = buildPayrollJournal([slip({ departmentId: null })], centres);

    expect(line.costCenter).toBe('UNASSIGNED');
  });

  it('shows an imbalance rather than hiding it', () => {
    const broken = slip({ netPay: 9_000_000 });
    const [line] = buildPayrollJournal([broken], centres);

    // 10,000,000 - 2,500,000 - 9,000,000 = -1,500,000
    expect(line.imbalance).toBe(-1_500_000);
  });

  it('emits CSV with a debit row, one credit row per deduction, and the net payable', () => {
    const csv = journalToCsv(buildPayrollJournal([slip()], centres));
    const rows = csv.split('\n');

    expect(rows[0]).toBe('cost_center,department,account,debit,credit');
    expect(rows[1]).toBe('CC-100,Produksi,BEBAN GAJI,10000000.00,0.00');
    expect(rows).toContain('CC-100,Produksi,PPh 21,0.00,1500000.00');
    expect(rows[rows.length - 1]).toBe('CC-100,Produksi,UTANG GAJI (NETTO),0.00,7500000.00');
  });

  it('neutralises a component name a spreadsheet would execute', () => {
    const injected = slip();
    injected.components = [
      { name: 'Gaji Pokok', type: 'ALLOWANCE', amount: 10_000_000 },
      { name: '=cmd|calc', type: 'DEDUCTION', amount: 2_500_000 },
    ];
    const csv = journalToCsv(buildPayrollJournal([injected], centres));

    // Component names are tenant-supplied and this file is opened in Excel.
    expect(csv).toContain("'=cmd|calc");
    expect(csv).not.toMatch(/,=cmd/);
  });
});
