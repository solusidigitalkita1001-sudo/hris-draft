/**
 * Bukti Pemotongan PPh Pasal 21 — Formulir 1721-A1 (GAP-32).
 *
 * WHERE THE LAYOUT COMES FROM. Transcribed from Lampiran I of
 * PER-2/PJ/2024, the form image on page 16 of
 * pajak.go.id/sites/default/files/Lampiran_PER02PJ2024.pdf, together with its
 * petunjuk pengisian. Facts taken from that document rather than assumed:
 *
 *   - The form is made in the LAST tax period: December, or the period an
 *     employee stops working.
 *   - Tax object code 21-100-01 for a pegawai tetap, 21-100-02 for a
 *     pensiunan receiving periodic pension money.
 *   - The bukti potong number is written `1.1-mm.yy-xxxxxxx`, the sequence
 *     running for one tax year and restarting at 0000001.
 *   - "Masa perolehan penghasilan" is written `mm-mm`.
 *   - Rupiah columns carry NO decimals: ten million is written 10.000.000,
 *     and 125,50 is written 125.
 *
 * NOT VERIFIED AGAINST A FILED FORM. The line numbers, labels and arithmetic
 * below come from the regulation; nobody has yet compared the output with a
 * 1721-A1 a tax office accepted. The figures are the part that is expensive to
 * get right and the part that does not change with the layout, so they are
 * assembled here and `verified: false` says plainly what has not happened.
 */

/** A line of Bagian B, exactly as the form prints it. */
export interface Form1721A1Line {
  /** 1..23, or '22a' style for the sub-lines the form itself numbers. */
  no: string;
  label: string;
  amount: number;
}

export type TaxObjectCode = '21-100-01' | '21-100-02';

/**
 * The labels are the form's own wording. Kept verbatim so a reader can hold
 * the output next to the printed form and match line for line.
 */
export const FORM_1721_A1_LABELS: Readonly<Record<string, string>> = {
  '1': 'GAJI ATAU UANG PENSIUN BERKALA',
  '2': 'TUNJANGAN PPh',
  '3': 'TUNJANGAN LAINNYA, UANG LEMBUR, DAN SEBAGAINYA',
  '4': 'HONORARIUM DAN IMBALAN LAIN SEJENISNYA',
  '5': 'PREMI ASURANSI YANG DIBAYARKAN PEMBERI KERJA',
  '6': 'PENERIMAAN DALAM BENTUK NATURA DAN KENIKMATAN LAINNYA YANG DIKENAKAN PEMOTONGAN PPh PASAL 21',
  '7': 'TANTIEM, BONUS, GRATIFIKASI, JASA PRODUKSI, DAN THR',
  '8': 'JUMLAH PENGHASILAN BRUTO (1 S.D. 7)',
  '9': 'BIAYA JABATAN/BIAYA PENSIUN',
  '10': 'IURAN TERKAIT PENSIUN ATAU HARI TUA',
  '11': 'ZAKAT/SUMBANGAN KEAGAMAAN YANG BERSIFAT WAJIB YANG DIBAYARKAN MELALUI PEMBERI KERJA',
  '12': 'JUMLAH PENGURANGAN (9 S.D. 11)',
  '13': 'JUMLAH PENGHASILAN NETO (8 - 12)',
  '14': 'PENGHASILAN NETO MASA PAJAK SEBELUMNYA',
  '15': 'JUMLAH PENGHASILAN NETO UNTUK PENGHITUNGAN PPh PASAL 21 (SETAHUN/DISETAHUNKAN)',
  '16': 'PENGHASILAN TIDAK KENA PAJAK (PTKP)',
  '17': 'PENGHASILAN KENA PAJAK SETAHUN/DISETAHUNKAN (15 - 16)',
  '18': 'PPh PASAL 21 ATAS PENGHASILAN KENA PAJAK SETAHUN/DISETAHUNKAN',
  '19': 'PPh PASAL 21 YANG TELAH DIPOTONG MASA PAJAK SEBELUMNYA',
  '20': 'PPh PASAL 21 DITANGGUNG PEMERINTAH (DTP) YANG TELAH DIPOTONG MASA PAJAK SEBELUMNYA',
  '21': 'PPh PASAL 21 TERUTANG (18 - 19 - 20)',
  '22': 'PPh PASAL 21 DAN PPh PASAL 26 YANG TELAH DIPOTONG DAN DILUNASI PADA SELAIN MASA PAJAK TERAKHIR',
  '22a': 'PPh PASAL 21 DIPOTONG',
  '22b': 'PPh PASAL 21 DITANGGUNG PEMERINTAH (DTP)',
  '23': 'PPh PASAL 21 KURANG BAYAR/LEBIH BAYAR MASA PAJAK TERAKHIR',
  '23a': 'PPh PASAL 21 DIPOTONG',
  '23b': 'PPh PASAL 21 DITANGGUNG PEMERINTAH (DTP)',
};

/**
 * Which bruto line a payslip component belongs to.
 *
 * Only the codes this product generates are classified. Anything else lands on
 * line 3 — "tunjangan lainnya ... dan sebagainya" — AND is named in the
 * warnings. A tenant's own component must never silently vanish from bruto:
 * under-reporting gross income on a bukti potong is the failure to avoid, and
 * line 3 is the form's own catch-all.
 */
const BRUTO_LINE_BY_CODE: Readonly<Record<string, string>> = {
  GP: '1',
  BASIC: '1',
  // Rapel is salary paid late, so it belongs with salary.
  ARREARS_EARNING_AUTO: '1',
  // The gross-up allowance IS tunjangan PPh; the form gives it its own line.
  TAX_ALLOWANCE_AUTO: '2',
  OVERTIME_EARNING_AUTO: '3',
  LEAVE_ENCASHMENT_AUTO: '3',
  THR_EARNING_AUTO: '7',
};

/** Employee-side deductions that reduce taxable income (line 10). */
const PENSION_DEDUCTION_CODES = new Set(['BPJS-TK']);

export interface Form1721A1Component {
  code: string | null;
  name: string;
  type: 'ALLOWANCE' | 'DEDUCTION';
  amount: number;
  isTaxable: boolean;
}

export interface Form1721A1Input {
  taxYear: number;
  /** Months of income in this tax year, for `mm-mm` and biaya jabatan. */
  firstMonth: number;
  lastMonth: number;
  taxObjectCode?: TaxObjectCode;
  /** Every component of every counted payslip in the year, flattened. */
  components: readonly Form1721A1Component[];
  /** PTKP for the employee's status, already resolved. */
  ptkp: number;
  /** Annual tax actually due, from the engine that computed it. */
  annualTaxDue: number;
  /** PPh 21 withheld across the year, from the payslips. */
  withheldTotal: number;
  /** Withheld in periods other than the last one. */
  withheldBeforeLastPeriod: number;
  biayaJabatanRate: number;
  biayaJabatanMaxMonth: number;
}

export interface Form1721A1 {
  taxObjectCode: TaxObjectCode;
  /** `mm-mm`, as the form writes it. */
  masaPerolehan: string;
  lines: Form1721A1Line[];
  /** Line number keyed, for callers that want to address one figure. */
  amounts: Readonly<Record<string, number>>;
  /**
   * Always false until the output has been compared with a 1721-A1 a tax
   * office accepted. Shipped as a field rather than a comment so a caller
   * cannot present this as a filed form by accident.
   */
  verified: false;
  warnings: string[];
}

/** The form carries no decimals, so every figure is a whole rupiah. */
const whole = (value: number) => Math.round(value);

export function buildForm1721A1(input: Form1721A1Input): Form1721A1 {
  const warnings: string[] = [];
  const amounts: Record<string, number> = Object.fromEntries(
    Object.keys(FORM_1721_A1_LABELS).map((no) => [no, 0]),
  );

  const unclassified = new Map<string, number>();
  for (const component of input.components) {
    if (component.type !== 'ALLOWANCE') continue;
    // Only income subject to PPh 21 belongs in bruto. A non-taxable allowance
    // is excluded by the same rule the monthly engine withholds by, so the two
    // cannot disagree about what was taxed.
    if (!component.isTaxable) continue;
    const line = component.code ? BRUTO_LINE_BY_CODE[component.code] : undefined;
    if (line) {
      amounts[line] += component.amount;
    } else {
      amounts['3'] += component.amount;
      unclassified.set(component.name, (unclassified.get(component.name) ?? 0) + component.amount);
    }
  }
  if (unclassified.size) {
    warnings.push(
      `form:UNCLASSIFIED_ON_LINE_3:${[...unclassified.keys()].sort().join(', ')}`,
    );
  }

  amounts['8'] = ['1', '2', '3', '4', '5', '6', '7'].reduce((sum, no) => sum + amounts[no], 0);

  // Biaya jabatan is 5% capped per MONTH, not once on the annual gross: the
  // two agree only for somebody who earned evenly all year.
  const months = Math.max(0, input.lastMonth - input.firstMonth + 1);
  amounts['9'] = Math.min(
    amounts['8'] * input.biayaJabatanRate,
    input.biayaJabatanMaxMonth * months,
  );
  amounts['10'] = input.components
    .filter((component) => component.type === 'DEDUCTION'
      && component.code !== null && PENSION_DEDUCTION_CODES.has(component.code))
    .reduce((sum, component) => sum + component.amount, 0);
  // Line 11 has no source: zakat paid through the employer is not modelled.
  if (amounts['11'] === 0) {
    warnings.push('form:ZAKAT_NOT_TRACKED_LINE_11');
  }
  amounts['12'] = amounts['9'] + amounts['10'] + amounts['11'];
  amounts['13'] = amounts['8'] - amounts['12'];

  // Line 14 is income from a previous employer, carried on their 1721-A1. The
  // product does not hold it, so it stays zero and says so — a joiner's form
  // is understated without it.
  if (input.firstMonth > 1) {
    warnings.push('form:PREVIOUS_EMPLOYER_NOT_TRACKED_LINE_14');
  }
  amounts['15'] = amounts['13'] + amounts['14'];
  amounts['16'] = input.ptkp;
  amounts['17'] = Math.max(0, amounts['15'] - amounts['16']);
  amounts['18'] = input.annualTaxDue;
  // Lines 19 and 20 are withholdings reported by a previous employer in the
  // same year; the same gap as line 14.
  amounts['21'] = amounts['18'] - amounts['19'] - amounts['20'];
  amounts['22a'] = input.withheldBeforeLastPeriod;
  amounts['22'] = amounts['22a'] + amounts['22b'];
  // What the last period settles: everything owed, less what was already taken.
  amounts['23a'] = input.withheldTotal - input.withheldBeforeLastPeriod;
  amounts['23'] = amounts['23a'] + amounts['23b'];

  for (const key of Object.keys(amounts)) amounts[key] = whole(amounts[key]);

  const pad = (month: number) => String(month).padStart(2, '0');
  return {
    taxObjectCode: input.taxObjectCode ?? '21-100-01',
    masaPerolehan: `${pad(input.firstMonth)}-${pad(input.lastMonth)}`,
    lines: Object.keys(FORM_1721_A1_LABELS).map((no) => ({
      no, label: FORM_1721_A1_LABELS[no], amount: amounts[no],
    })),
    amounts,
    verified: false,
    warnings,
  };
}

/**
 * The bukti potong number, `1.1-mm.yy-xxxxxxx`.
 *
 * The sequence is the caller's to keep: it runs for one tax year across every
 * employee and restarts at 1 in January, which is a register this product does
 * not hold yet. Formatting it here at least means the shape is right wherever
 * the number comes from.
 */
export function formatBuktiPotongNumber(taxMonth: number, taxYear: number, sequence: number): string {
  if (taxMonth < 1 || taxMonth > 12) throw new Error(`Tax month must be 1..12, received ${taxMonth}`);
  if (sequence < 1 || sequence > 9_999_999) throw new Error(`Sequence must be 1..9999999, received ${sequence}`);
  const mm = String(taxMonth).padStart(2, '0');
  const yy = String(taxYear % 100).padStart(2, '0');
  return `1.1-${mm}.${yy}-${String(sequence).padStart(7, '0')}`;
}
