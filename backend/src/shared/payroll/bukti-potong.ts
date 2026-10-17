import { SEVERANCE_TAX_BRACKETS } from './severance-tax';

/**
 * Bukti pemotongan PPh 21 selain 1721-A1 (GAP-33, sisa e-Bupot).
 *
 * WHERE THE LAYOUT COMES FROM. Ditranskripsi dari Lampiran I PER-2/PJ/2024
 * (berkas resmi `Lampiran_PER02PJ2024.pdf`), formulir dan petunjuk
 * pengisiannya:
 *
 *   - 1721-VIII (hal. 15, petunjuk hal. 27-28): bukti potong PPh 21 BULANAN
 *     untuk pegawai tetap (kode objek 21-100-01) dan pensiunan berkala
 *     (21-100-02). Dibuat pada SETIAP masa pajak selain masa pajak terakhir;
 *     masa terakhir memakai 1721-A1, dan VIII "bukan kredit pajak ... satu
 *     kesatuan dengan Formulir 1721-A1". Nomor: `1.5-mm.yy-xxxxxxx`.
 *     Kolom: kode objek, bruto, dasar pengenaan pajak, tanda X bila tidak
 *     ber-NPWP (tarif lebih tinggi 20%), tarif %, PPh dipotong.
 *   - 1721-VII (hal. 14, petunjuk hal. 25-26): bukti potong PPh 21 FINAL.
 *     Kode objek 21-401-01 uang pesangon dibayarkan sekaligus, 21-401-02
 *     manfaat pensiun/THT/JHT sekaligus, 21-499-99 final lainnya.
 *     Nomor: `1.4-mm.yy-xxxxxxx`. Kolom: kode objek, bruto, tarif %
 *     ("jika beberapa tarif, tuliskan tarif tertinggi"), PPh dipotong.
 *   - Nilai rupiah TANPA desimal (petunjuk umum hal. 17).
 *
 * Yang DIHASILKAN di sini adalah data formulir untuk dimasukkan/diimpor ke
 * aplikasi e-Bupot 21/26 DJP — bukan berkas impor aplikasi itu sendiri, yang
 * formatnya artefak aplikasi dan bukan bagian PER-2/PJ/2024. Nomor urut bukti
 * potong juga diterbitkan e-Bupot; pembentuk nomor di bawah ada untuk tenant
 * yang menatausahakan nomornya sendiri.
 */

export type MonthlyTaxObjectCode = '21-100-01' | '21-100-02';
export type FinalTaxObjectCode = '21-401-01' | '21-401-02' | '21-499-99';

/** Kode nomor bukti potong per formulir (header "1 . x" pada tiap form). */
export const FORM_NUMBER_CODES = {
  '1721-A1': '1.1',
  '1721-VI': '1.3',
  '1721-VII': '1.4',
  '1721-VIII': '1.5',
} as const;

export type BuktiPotongForm = keyof typeof FORM_NUMBER_CODES;

/** `1.x-mm.yy-xxxxxxx`; urutan berjalan setahun pajak dan kembali ke 1. */
export function formatBuktiPotongNumberFor(
  form: BuktiPotongForm, taxMonth: number, taxYear: number, sequence: number,
): string {
  if (taxMonth < 1 || taxMonth > 12) throw new Error(`Tax month must be 1..12, received ${taxMonth}`);
  if (sequence < 1 || sequence > 9_999_999) throw new Error(`Sequence must be 1..9999999, received ${sequence}`);
  const mm = String(taxMonth).padStart(2, '0');
  const yy = String(taxYear % 100).padStart(2, '0');
  return `${FORM_NUMBER_CODES[form]}-${mm}.${yy}-${String(sequence).padStart(7, '0')}`;
}

const whole = (value: number) => Math.round(value);

export interface Form1721VIIIInput {
  taxMonth: number;
  taxYear: number;
  taxObjectCode?: MonthlyTaxObjectCode;
  /** Penghasilan bruto kena pajak masa itu (jumlah komponen taxable). */
  bruto: number;
  /**
   * Dasar pengenaan pajak. Di bawah TER bulanan (PMK 168/2023) DPP = bruto;
   * pemanggil boleh mengoper nilai lain bila dasar hukumnya berbeda.
   */
  dpp?: number;
  /** PPh 21 yang benar-benar dipotong pada masa itu (dari payslip). */
  pphDipotong: number;
  hasNpwp: boolean;
}

export interface Form1721VIII {
  form: '1721-VIII';
  taxObjectCode: MonthlyTaxObjectCode;
  /** `mm-yyyy`, persis cara form menulis Masa Pajak – Tahun Pajak. */
  masaPajak: string;
  bruto: number;
  dasarPengenaanPajak: number;
  /** Kolom (4): tanda X bila penerima tidak ber-NPWP (tarif lebih tinggi 20%). */
  tanpaNpwp: boolean;
  /**
   * Kolom (5), persen. Diturunkan dari angka yang DIBEKUKAN payslip
   * (pph ÷ DPP) — itulah tarif yang benar-benar diterapkan; menghitung ulang
   * dari tabel bisa berbeda bila tabel berubah setelah run.
   */
  tarifPercent: number;
  pphDipotong: number;
  verified: false;
  warnings: string[];
}

export function buildForm1721VIII(input: Form1721VIIIInput): Form1721VIII {
  const warnings: string[] = [];
  const bruto = whole(Math.max(0, input.bruto));
  const dpp = whole(Math.max(0, input.dpp ?? input.bruto));
  const pph = whole(Math.max(0, input.pphDipotong));
  const tarifPercent = dpp > 0 ? Math.round((pph / dpp) * 10000) / 100 : 0;
  if (dpp === 0 && pph > 0) {
    warnings.push('form:PPH_WITHOUT_DPP');
  }
  return {
    form: '1721-VIII',
    taxObjectCode: input.taxObjectCode ?? '21-100-01',
    masaPajak: `${String(input.taxMonth).padStart(2, '0')}-${input.taxYear}`,
    bruto,
    dasarPengenaanPajak: dpp,
    tanpaNpwp: !input.hasNpwp,
    tarifPercent,
    pphDipotong: pph,
    verified: false,
    warnings,
  };
}

export interface Form1721VIIInput {
  taxMonth: number;
  taxYear: number;
  taxObjectCode?: FinalTaxObjectCode;
  /** Bruto pesangon (UP+UPMK+UPH) yang dibayarkan. */
  bruto: number;
  /** PPh 21 final yang dipotong, beku sejak pendaftaran pembayaran. */
  pphDipotong: number;
  /**
   * Bruto kumulatif seluruh cicilan pemutusan yang sama (PP 68/2009 pasal 2
   * ayat (2)) — menentukan lapisan tarif tertinggi yang pernah dipakai.
   */
  cumulativeGross?: number;
}

export interface Form1721VII {
  form: '1721-VII';
  taxObjectCode: FinalTaxObjectCode;
  masaPajak: string;
  bruto: number;
  /** Kolom (3): "jika beberapa tarif, tuliskan tarif tertinggi". */
  tarifPercent: number;
  pphDipotong: number;
  verified: false;
  warnings: string[];
}

/** Lapisan tertinggi PP 68/2009 yang tersentuh bruto kumulatif tersebut. */
export function severanceTopRatePercent(cumulativeGross: number): number {
  let top = 0;
  let floor = 0;
  for (const [limit, rate] of SEVERANCE_TAX_BRACKETS) {
    if (cumulativeGross > floor) top = rate * 100;
    floor = limit;
    if (!Number.isFinite(limit)) break;
    if (cumulativeGross <= limit) break;
  }
  return top;
}

export function buildForm1721VII(input: Form1721VIIInput): Form1721VII {
  const warnings: string[] = [];
  const bruto = whole(Math.max(0, input.bruto));
  const pph = whole(Math.max(0, input.pphDipotong));
  const tarifPercent = severanceTopRatePercent(Math.max(input.cumulativeGross ?? bruto, bruto));
  if (pph === 0 && tarifPercent > 0) {
    // Mungkin benar (cicilan pertama habis di lapisan 0%), tapi pantas dilihat.
    warnings.push('form:ZERO_TAX_AT_NONZERO_RATE');
  }
  return {
    form: '1721-VII',
    taxObjectCode: input.taxObjectCode ?? '21-401-01',
    masaPajak: `${String(input.taxMonth).padStart(2, '0')}-${input.taxYear}`,
    bruto,
    tarifPercent,
    pphDipotong: pph,
    verified: false,
    warnings,
  };
}
