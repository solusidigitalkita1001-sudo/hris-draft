/**
 * B.5 Payslip Breakdown Pure Builder (no DB, pure function).
 *
 * Mengubah array PayslipComponent prisma flat menjadi struktur grouping
 * EARNINGS / DEDUCTIONS yang siap dipakai frontend render payslip detail atau PDF.
 *
 * Termasuk label ID mapping untuk component statutory PPh21/BPJS supaya
 * muncul label yang jelas di payslip bukan cuma code.
 */

export interface PayslipComponentRow {
  id?: string;
  name: string;
  amount: number;
  type: 'ALLOWANCE' | 'DEDUCTION';
  /** Short canonical code for component, e.g. BPJS-TK / PPH21 / BASIC */
  code?: string;
  /** Deskripsi panjang statutory / tunjangan */
  description?: string;
  isTaxable?: boolean;
}

export interface PayslipBreakdown {
  baseSalary: number;
  /** Earnings, exactly as the payslip recorded them. */
  earnings: PayslipComponentRow[];
  totalEarnings: number;
  /** Deductions: statutory + loans etc */
  deductions: PayslipComponentRow[];
  totalDeductions: number;
  takeHomePay: number;
  /**
   * Whether the rows account for the money, and what is missing if they do not.
   *
   * The stored totals are what moved; the rows are what the payslip can show.
   * They should agree, and when they do not the reason is almost always a
   * salary allocation with no component for base pay — so the figures say so
   * instead of being quietly reconciled by an invented row.
   */
  reconciliation: {
    /** Summed from the rows alone. */
    rowsEarnings: number;
    rowsDeductions: number;
    rowsTakeHomePay: number;
    /** False when the rows do not account for the stored totals. */
    matchesStored: boolean;
    /** Stored earnings minus the rows' earnings; 0 when they agree. */
    unaccountedEarnings: number;
    /**
     * Base salary that no component represents. Not added to anything: it was
     * not paid, and showing it as income would make the payslip disagree with
     * the transfer.
     */
    unallocatedBaseSalary: number;
  };
  /** Summary potongan statutory (ringkasan cepat) */
  statutorySummary: {
    bpjsTK: number;       // JHT employee + JP employee
    bpjsKesehatan: number; // JKN employee
    pph21: number;        // PPh 21
    otherStatutory: number;
  };
}

/**
 * Mapping canonical component code → label ID + description.
 * Matching by salaryComponent.code (jika ada dari DB) atau component.name contain keyword.
 */
const LABEL_MAP: Record<string, { label: string; description: string }> = {
  'BPJS-TK': {
    label: 'BPJS Ketenagakerjaan (JHT + JP)',
    description: 'Iuran Jaminan Hari Tua 2% + Jaminan Pensiun 1% (potongan karyawan)',
  },
  'BPJS-KES': {
    label: 'BPJS Kesehatan (JKN)',
    description: 'Iuran Jaminan Kesehatan Nasional 1% (potongan karyawan, cap 12jt)',
  },
  PPH21: {
    label: 'PPh 21 Pasal 21',
    description: 'Pajak Penghasilan Pasal 21 bulanan UU HPP 2022 (tarif progresif 5%-35%)',
  },
  BASIC: { label: 'Gaji Pokok', description: 'Gaji dasar pokok per bulan' },
  OVERTIME: { label: 'Uang Lembur', description: 'Total lembur periode (PP No. 78 Th 2015)' },
  MEAL: { label: 'Tunjangan Makan', description: 'Tunjangan konsumsi harian x hari hadir' },
  TRANSPORT: { label: 'Tunjangan Transportasi', description: 'Tunjangan transport / commuter' },
  THR: { label: 'THR (Tunjangan Hari Raya)', description: 'THR prorata / penuh sesuai Permenaker 6/2016' },
  LOAN: { label: 'Cicilan Pinjaman Karyawan', description: 'Potongan cicilan pinjaman karyawan' },
};

const CODE_REGEXES: Array<{ test: (name: string) => boolean; code: string }> = [
  { test: (n) => /JHT|JKK|JKM|BPJS.*TK|Ketenagakerjaan|Jaminan Pensiun|JP/i.test(n), code: 'BPJS-TK' },
  { test: (n) => /JKN|Kesehatan|BPJS.*KES/i.test(n), code: 'BPJS-KES' },
  { test: (n) => /PPh\s*21|Pajak Penghasilan|PPh21/i.test(n), code: 'PPH21' },
  // OVERTIME: hindari match substring "OT" di tengah kata (mis. "Motor", "Biotin").
  // Pakai word boundary atau pattern: "Uang Lembur", "Lembur", "Overtime", kata "OT" berdiri sendiri.
  { test: (n) => /(?:uang\s+lembur|lembur|overtime|over\s+time|(?:^|\s)ot(?:\s|$))/i.test(n), code: 'OVERTIME' },
  { test: (n) => /Makan|Meal|Konsumsi/i.test(n), code: 'MEAL' },
  { test: (n) => /Transport|Bensin|Jalan|Commuter/i.test(n), code: 'TRANSPORT' },
  { test: (n) => /THR|Hari Raya|Lebaran/i.test(n), code: 'THR' },
  { test: (n) => /Cicilan|Pinjaman|Loan|Kasbon/i.test(n), code: 'LOAN' },
];

function detectCode(comp: { name: string; salaryComponent?: { code?: string | null } | null }): string {
  if (comp.salaryComponent?.code) {
    const code = comp.salaryComponent.code.toUpperCase();
    if (LABEL_MAP[code]) return code;
  }
  for (const rule of CODE_REGEXES) if (rule.test(comp.name)) return rule.code;
  return comp.name.toUpperCase().replace(/\s+/g, '_').slice(0, 10);
}

function buildRow(
  comp: { id?: string; name: string; type: string; amount: number | string; isTaxable?: boolean; salaryComponent?: { code?: string | null } | null }
): PayslipComponentRow {
  const code = detectCode(comp as any);
  const label = LABEL_MAP[code]?.label ?? comp.name;
  const description = LABEL_MAP[code]?.description;
  return {
    id: comp.id,
    name: label,
    code,
    description,
    amount: Number(comp.amount) || 0,
    type: comp.type as 'ALLOWANCE' | 'DEDUCTION',
    isTaxable: comp.isTaxable,
  };
}

/**
 * Build payslip breakdown structure dari prisma payslip + components flat.
 * Pure function — mudah di-Jest tanpa setup DB.
 */
export function buildPayslipBreakdown(input: {
  baseSalary: number | string;
  totalEarnings?: number | string;
  totalDeductions?: number | string;
  netPay?: number | string;
  components: Array<{
    id?: string;
    name: string;
    type: string;
    amount: number | string;
    isTaxable?: boolean;
    salaryComponent?: { code?: string | null } | null;
  }>;
}): PayslipBreakdown {
  const base = Number(input.baseSalary) || 0;
  const rows = (input.components ?? []).map((c) => buildRow(c));

  // A base-salary row is NO LONGER INVENTED when the allocation has none.
  //
  // It used to be, with a comment saying base pay "umumnya ada di field
  // Payslip.baseSalary, bukan di PayslipComponent" — and the stored
  // totalEarnings and netPay passed into this function were then ignored and
  // recomputed from the rows. So for an allocation without a base-pay
  // component the payslip showed base salary as income while the bank transfer
  // paid netPay, which does not include it: the slip and the money disagreed,
  // and the two stored figures that would have revealed it were discarded.
  //
  // The rows now show what was recorded, the stored totals are believed, and
  // any gap is reported rather than filled in.
  const earnings = rows.filter((r) => r.type === 'ALLOWANCE');
  const deductions = rows.filter((r) => r.type === 'DEDUCTION');
  const rowsEarnings = earnings.reduce((s, r) => s + r.amount, 0);
  const rowsDeductions = deductions.reduce((s, r) => s + r.amount, 0);

  const hasStored = input.totalEarnings !== undefined || input.netPay !== undefined;
  const storedEarnings = Number(input.totalEarnings ?? NaN);
  const storedDeductions = Number(input.totalDeductions ?? NaN);
  const storedNet = Number(input.netPay ?? NaN);
  const totalEarnings = Number.isFinite(storedEarnings) ? storedEarnings : rowsEarnings;
  const totalDeductions = Number.isFinite(storedDeductions) ? storedDeductions : rowsDeductions;
  const takeHomePay = Number.isFinite(storedNet) ? storedNet : rowsEarnings - rowsDeductions;

  const unaccountedEarnings = Number((totalEarnings - rowsEarnings).toFixed(2));
  const hasBasicComponent = rows.some((r) => r.code === 'BASIC');
  const reconciliation = {
    rowsEarnings,
    rowsDeductions,
    rowsTakeHomePay: rowsEarnings - rowsDeductions,
    matchesStored: !hasStored
      || (unaccountedEarnings === 0 && Number((totalDeductions - rowsDeductions).toFixed(2)) === 0),
    unaccountedEarnings,
    unallocatedBaseSalary: hasBasicComponent || base <= 0 ? 0 : base,
  };

  // Statutory summary (potongan wajib dari employee)
  const sumCode = (code: string) => deductions.filter((r) => r.code === code).reduce((s, r) => s + r.amount, 0);
  const bpjsTK = sumCode('BPJS-TK');
  const bpjsKesehatan = sumCode('BPJS-KES');
  const pph21 = sumCode('PPH21');
  const statutoryTotal = bpjsTK + bpjsKesehatan + pph21;
  const otherStatutory = totalDeductions - statutoryTotal - sumCode('LOAN');

  return {
    baseSalary: base,
    earnings,
    totalEarnings,
    deductions,
    totalDeductions,
    takeHomePay,
    reconciliation,
    statutorySummary: {
      bpjsTK,
      bpjsKesehatan,
      pph21,
      otherStatutory: Math.max(0, otherStatutory),
    },
  };
}
