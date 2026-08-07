/**
 * Depresiasi aset (hardening Business Rule Gap modul Asset Management).
 *
 * Mendukung 4 metode akuntansi:
 *   - STRAIGHT_LINE       : (harga perolehan - nilai residu) / umur ekonomis.
 *   - DECLINING_BALANCE   : saldo menurun ganda (double declining), rate = 2/umur.
 *   - SUM_OF_YEARS_DIGITS : jumlah angka tahun.
 *   - UNITS_OF_PRODUCTION : berdasarkan unit produksi/pemakaian aktual.
 *
 * Nilai buku (book value) di titik waktu tertentu dipakai untuk menghitung
 * sisa nilai aset hilang/rusak yang dibebankan ke final payroll karyawan.
 *
 * Semua fungsi PURE (tanpa DB).
 */

export type DepreciationMethod =
  | 'STRAIGHT_LINE'
  | 'DECLINING_BALANCE'
  | 'SUM_OF_YEARS_DIGITS'
  | 'UNITS_OF_PRODUCTION';

export interface DepreciationRow {
  year: number; // 1..usefulLifeYears
  depreciation: number;
  accumulated: number;
  bookValue: number;
}

export interface DepreciationInput {
  purchaseValue: number;
  /** Nilai residu / sisa di akhir umur ekonomis. Default 0. */
  salvageValue?: number;
  usefulLifeYears: number;
  method?: DepreciationMethod;
  /** Untuk UNITS_OF_PRODUCTION: total kapasitas unit selama umur ekonomis. */
  totalUnits?: number;
  /** Untuk UNITS_OF_PRODUCTION: unit terpakai per tahun. */
  unitsPerYear?: number[];
}

function round(n: number): number {
  return Math.round(n);
}

export function generateDepreciationSchedule(input: DepreciationInput): DepreciationRow[] {
  const method = input.method ?? 'STRAIGHT_LINE';
  const salvage = input.salvageValue ?? 0;
  const life = input.usefulLifeYears;
  const cost = input.purchaseValue;
  const depreciableBase = Math.max(0, cost - salvage);

  if (life <= 0) return [];

  const rows: DepreciationRow[] = [];
  let bookValue = cost;
  let accumulated = 0;

  for (let year = 1; year <= life; year++) {
    let dep = 0;

    if (method === 'STRAIGHT_LINE') {
      dep = depreciableBase / life;
    } else if (method === 'DECLINING_BALANCE') {
      const rate = 2 / life;
      dep = bookValue * rate;
      // Tidak boleh menurunkan book value di bawah nilai residu.
      if (bookValue - dep < salvage) dep = bookValue - salvage;
      // Tahun terakhir: habiskan sisa hingga nilai residu.
      if (year === life) dep = bookValue - salvage;
    } else if (method === 'SUM_OF_YEARS_DIGITS') {
      const syd = (life * (life + 1)) / 2;
      dep = depreciableBase * ((life - year + 1) / syd);
    } else if (method === 'UNITS_OF_PRODUCTION') {
      const totalUnits = input.totalUnits ?? 0;
      const used = input.unitsPerYear?.[year - 1] ?? 0;
      dep = totalUnits > 0 ? depreciableBase * (used / totalUnits) : 0;
    }

    dep = round(Math.max(0, dep));
    // Jangan melewati batas terdepresiasi.
    if (accumulated + dep > depreciableBase) dep = depreciableBase - accumulated;

    accumulated += dep;
    bookValue = cost - accumulated;
    rows.push({ year, depreciation: dep, accumulated, bookValue });
  }

  return rows;
}

/**
 * Nilai buku aset setelah sejumlah bulan pemakaian (garis lurus prorata bulanan
 * untuk presisi; metode lain memakai pembulatan tahunan lalu prorata garis lurus
 * dalam tahun berjalan). Dipakai untuk beban aset hilang saat resign.
 */
export function bookValueAfterMonths(
  input: DepreciationInput & { asOfMonths: number }
): number {
  const salvage = input.salvageValue ?? 0;
  const cost = input.purchaseValue;
  const totalMonths = input.usefulLifeYears * 12;
  const months = Math.min(Math.max(0, input.asOfMonths), totalMonths);

  if ((input.method ?? 'STRAIGHT_LINE') === 'STRAIGHT_LINE') {
    const monthlyDep = (cost - salvage) / totalMonths;
    return round(Math.max(salvage, cost - monthlyDep * months));
  }

  // Metode non-linear: pakai schedule tahunan + prorata garis lurus di tahun berjalan.
  const schedule = generateDepreciationSchedule(input);
  const fullYears = Math.floor(months / 12);
  const remMonths = months % 12;
  const bookAtYear = fullYears === 0 ? cost : schedule[fullYears - 1]?.bookValue ?? cost;
  if (remMonths === 0 || fullYears >= schedule.length) return round(bookAtYear);

  const yearDep = schedule[fullYears]?.depreciation ?? 0;
  return round(Math.max(salvage, bookAtYear - (yearDep * remMonths) / 12));
}
