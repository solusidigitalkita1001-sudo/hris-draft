import { generateDepreciationSchedule, bookValueAfterMonths } from './depreciation';

describe('depresiasi aset (hardening Asset Management)', () => {
  describe('STRAIGHT_LINE — AC laptop 15jt, 4 tahun', () => {
    const rows = generateDepreciationSchedule({
      purchaseValue: 15_000_000,
      usefulLifeYears: 4,
      method: 'STRAIGHT_LINE',
    });

    it('penyusutan per tahun = 3,75jt', () => {
      expect(rows).toHaveLength(4);
      rows.forEach((r) => expect(r.depreciation).toBe(3_750_000));
    });

    it('book value akhir = 0', () => {
      expect(rows[3].bookValue).toBe(0);
    });

    it('book value setelah 2 tahun = 7,5jt (dasar beban aset hilang saat resign)', () => {
      expect(rows[1].bookValue).toBe(7_500_000);
      expect(bookValueAfterMonths({ purchaseValue: 15_000_000, usefulLifeYears: 4, asOfMonths: 24 })).toBe(7_500_000);
    });
  });

  describe('DECLINING_BALANCE (double declining) — laptop 15jt, 4 tahun', () => {
    const rows = generateDepreciationSchedule({
      purchaseValue: 15_000_000,
      usefulLifeYears: 4,
      method: 'DECLINING_BALANCE',
    });

    it('tahun-1 = 50% × 15jt = 7,5jt (rate 2/4)', () => {
      expect(rows[0].depreciation).toBe(7_500_000);
      expect(rows[0].bookValue).toBe(7_500_000);
    });

    it('tahun-2 = 50% × 7,5jt = 3,75jt', () => {
      expect(rows[1].depreciation).toBe(3_750_000);
    });

    it('book value akhir = 0 (residu 0, tahun terakhir menghabiskan sisa)', () => {
      expect(rows[3].bookValue).toBe(0);
    });
  });

  describe('SUM_OF_YEARS_DIGITS — 15jt, 4 tahun (SYD=10)', () => {
    const rows = generateDepreciationSchedule({
      purchaseValue: 15_000_000,
      usefulLifeYears: 4,
      method: 'SUM_OF_YEARS_DIGITS',
    });

    it('tahun-1 = 4/10 × 15jt = 6jt', () => {
      expect(rows[0].depreciation).toBe(6_000_000);
    });

    it('total akumulasi = 15jt', () => {
      expect(rows[3].accumulated).toBe(15_000_000);
    });
  });

  describe('UNITS_OF_PRODUCTION', () => {
    it('depresiasi proporsional terhadap unit terpakai', () => {
      const rows = generateDepreciationSchedule({
        purchaseValue: 10_000_000,
        usefulLifeYears: 3,
        method: 'UNITS_OF_PRODUCTION',
        totalUnits: 1000,
        unitsPerYear: [400, 400, 200],
      });
      expect(rows[0].depreciation).toBe(4_000_000);
      expect(rows[2].depreciation).toBe(2_000_000);
      expect(rows[2].bookValue).toBe(0);
    });
  });

  describe('nilai residu (salvage)', () => {
    it('straight line dengan residu 3jt', () => {
      const rows = generateDepreciationSchedule({
        purchaseValue: 15_000_000,
        salvageValue: 3_000_000,
        usefulLifeYears: 4,
        method: 'STRAIGHT_LINE',
      });
      expect(rows[0].depreciation).toBe(3_000_000); // (15-3)/4
      expect(rows[3].bookValue).toBe(3_000_000);
    });
  });
});
