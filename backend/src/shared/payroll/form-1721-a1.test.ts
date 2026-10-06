import {
  buildForm1721A1,
  formatBuktiPotongNumber,
  FORM_1721_A1_LABELS,
  type Form1721A1Component,
} from './form-1721-a1';

/**
 * The layout is transcribed from Lampiran I PER-2/PJ/2024. These pin the
 * arithmetic the form states between its own line numbers, and the rule that
 * no money may leave the bruto because a component was not recognised.
 */
const allowance = (code: string | null, amount: number, name = code ?? 'Lainnya'): Form1721A1Component =>
  ({ code, name, type: 'ALLOWANCE', amount, isTaxable: true });
const deduction = (code: string | null, amount: number, name = code ?? 'Potongan'): Form1721A1Component =>
  ({ code, name, type: 'DEDUCTION', amount, isTaxable: false });

const base = {
  taxYear: 2026, firstMonth: 1, lastMonth: 12,
  ptkp: 54_000_000, annualTaxDue: 20_000_000,
  withheldTotal: 20_000_000, withheldBeforeLastPeriod: 18_000_000,
  biayaJabatanRate: 0.05, biayaJabatanMaxMonth: 500_000,
};

describe('Formulir 1721-A1 line assembly', () => {
  it('puts each component on the line the form names for it', () => {
    const form = buildForm1721A1({
      ...base,
      components: [
        allowance('GP', 120_000_000),
        allowance('TAX_ALLOWANCE_AUTO', 3_000_000),
        allowance('OVERTIME_EARNING_AUTO', 5_000_000),
        allowance('THR_EARNING_AUTO', 10_000_000),
        deduction('BPJS-TK', 3_600_000),
      ],
    });
    expect(form.amounts['1']).toBe(120_000_000);
    expect(form.amounts['2']).toBe(3_000_000);
    expect(form.amounts['3']).toBe(5_000_000);
    expect(form.amounts['7']).toBe(10_000_000);
    expect(form.amounts['10']).toBe(3_600_000);
  });

  it('totals bruto as the form states: 1 s.d. 7', () => {
    const form = buildForm1721A1({
      ...base,
      components: [allowance('GP', 100_000_000), allowance('THR_EARNING_AUTO', 8_000_000)],
    });
    expect(form.amounts['8']).toBe(108_000_000);
  });

  it('never loses an unrecognised component, and names it', () => {
    // Under-reporting gross income on a bukti potong is the failure to avoid,
    // so a tenant's own component lands on the form's own catch-all line.
    const form = buildForm1721A1({
      ...base,
      components: [allowance('GP', 100_000_000), allowance('TUNJ_KHUSUS', 4_000_000, 'Tunjangan Khusus')],
    });
    expect(form.amounts['3']).toBe(4_000_000);
    expect(form.amounts['8']).toBe(104_000_000);
    expect(form.warnings.join()).toContain('Tunjangan Khusus');
  });

  it('leaves a non-taxable allowance out of bruto', () => {
    // The same rule the monthly engine withholds by, so the two cannot
    // disagree about what was taxed.
    const form = buildForm1721A1({
      ...base,
      components: [
        allowance('GP', 100_000_000),
        { code: 'TM', name: 'Tunjangan Makan', type: 'ALLOWANCE', amount: 6_000_000, isTaxable: false },
      ],
    });
    expect(form.amounts['8']).toBe(100_000_000);
  });

  it('caps biaya jabatan per month, not once on the annual gross', () => {
    // 5% of 240 juta is 12 juta; the cap is 500rb x 12 = 6 juta.
    const form = buildForm1721A1({ ...base, components: [allowance('GP', 240_000_000)] });
    expect(form.amounts['9']).toBe(6_000_000);
  });

  it('caps biaya jabatan by the months actually worked', () => {
    // Four months of income can only carry four months of the allowance.
    const form = buildForm1721A1({
      ...base, firstMonth: 9, lastMonth: 12,
      components: [allowance('GP', 240_000_000)],
    });
    expect(form.amounts['9']).toBe(2_000_000);
  });

  it('follows the arithmetic the form prints between its lines', () => {
    const form = buildForm1721A1({
      ...base,
      components: [allowance('GP', 120_000_000), deduction('BPJS-TK', 3_600_000)],
    });
    expect(form.amounts['12']).toBe(form.amounts['9'] + form.amounts['10'] + form.amounts['11']);
    expect(form.amounts['13']).toBe(form.amounts['8'] - form.amounts['12']);
    expect(form.amounts['15']).toBe(form.amounts['13'] + form.amounts['14']);
    expect(form.amounts['17']).toBe(form.amounts['15'] - form.amounts['16']);
    expect(form.amounts['21']).toBe(form.amounts['18'] - form.amounts['19'] - form.amounts['20']);
    expect(form.amounts['22']).toBe(form.amounts['22a'] + form.amounts['22b']);
    expect(form.amounts['23']).toBe(form.amounts['23a'] + form.amounts['23b']);
  });

  it('settles the last period with what the year still owes', () => {
    const form = buildForm1721A1({
      ...base, withheldTotal: 20_000_000, withheldBeforeLastPeriod: 18_000_000,
      components: [allowance('GP', 120_000_000)],
    });
    expect(form.amounts['22a']).toBe(18_000_000);
    expect(form.amounts['23a']).toBe(2_000_000);
  });

  it('never lets PKP go negative', () => {
    const form = buildForm1721A1({ ...base, components: [allowance('GP', 10_000_000)] });
    expect(form.amounts['17']).toBe(0);
  });

  it('writes masa perolehan as mm-mm', () => {
    expect(buildForm1721A1({ ...base, components: [] }).masaPerolehan).toBe('01-12');
    expect(buildForm1721A1({ ...base, firstMonth: 3, lastMonth: 9, components: [] }).masaPerolehan)
      .toBe('03-09');
  });

  it('defaults to the pegawai tetap object code', () => {
    expect(buildForm1721A1({ ...base, components: [] }).taxObjectCode).toBe('21-100-01');
    expect(buildForm1721A1({ ...base, taxObjectCode: '21-100-02', components: [] }).taxObjectCode)
      .toBe('21-100-02');
  });

  it('carries no decimals, as the petunjuk pengisian requires', () => {
    // "Dalam menuliskan seratus dua puluh lima rupiah lima puluh sen adalah: 125".
    const form = buildForm1721A1({ ...base, components: [allowance('GP', 125.5)] });
    expect(Number.isInteger(form.amounts['8'])).toBe(true);
    for (const line of form.lines) expect(Number.isInteger(line.amount)).toBe(true);
  });

  it('says what it does not know instead of filling it in', () => {
    const joiner = buildForm1721A1({ ...base, firstMonth: 7, components: [allowance('GP', 60_000_000)] });
    // A mid-year joiner's form is understated without the previous employer's
    // figures, and this product does not hold them.
    expect(joiner.warnings).toContain('form:PREVIOUS_EMPLOYER_NOT_TRACKED_LINE_14');
    expect(joiner.amounts['14']).toBe(0);
    expect(joiner.warnings).toContain('form:ZAKAT_NOT_TRACKED_LINE_11');
  });

  it('declares itself unverified against a real filed form', () => {
    // A field rather than a comment, so a caller cannot present this as filed.
    expect(buildForm1721A1({ ...base, components: [] }).verified).toBe(false);
  });

  it('emits every line the form prints, labelled as the form prints it', () => {
    const form = buildForm1721A1({ ...base, components: [] });
    expect(form.lines).toHaveLength(Object.keys(FORM_1721_A1_LABELS).length);
    expect(form.lines[0]).toMatchObject({ no: '1', label: 'GAJI ATAU UANG PENSIUN BERKALA' });
    expect(form.lines.map((line) => line.no)).toEqual(expect.arrayContaining(['22a', '22b', '23a', '23b']));
  });
});

describe('the bukti potong number', () => {
  it('is written 1.1-mm.yy-xxxxxxx', () => {
    expect(formatBuktiPotongNumber(12, 2026, 1)).toBe('1.1-12.26-0000001');
    expect(formatBuktiPotongNumber(7, 2024, 1234567)).toBe('1.1-07.24-1234567');
  });

  it('refuses a month or sequence the format cannot hold', () => {
    expect(() => formatBuktiPotongNumber(13, 2026, 1)).toThrow(/1\.\.12/);
    expect(() => formatBuktiPotongNumber(12, 2026, 0)).toThrow(/1\.\.9999999/);
    expect(() => formatBuktiPotongNumber(12, 2026, 10_000_000)).toThrow();
  });
});
