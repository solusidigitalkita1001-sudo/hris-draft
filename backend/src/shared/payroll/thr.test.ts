import { calculateThr, tenureMonths, THR_MIN_MONTHS_FULL } from './thr';

describe('THR calculator — Permenaker 6/2016 (hardening Business Rule Gap Payroll)', () => {
  describe('tenureMonths', () => {
    it('menghitung bulan penuh (floor)', () => {
      expect(tenureMonths(new Date(Date.UTC(2023, 0, 1)), new Date(Date.UTC(2024, 0, 1)))).toBe(12);
      expect(tenureMonths(new Date(Date.UTC(2023, 5, 15)), new Date(Date.UTC(2024, 3, 1)))).toBe(9); // 15 Jun 2023 → 1 Apr 2024 = 9 bln penuh
      expect(tenureMonths(new Date(Date.UTC(2024, 0, 20)), new Date(Date.UTC(2024, 0, 25)))).toBe(0);
    });
  });

  describe('kelayakan & nominal', () => {
    const wage = 6_000_000;
    const raya = new Date(Date.UTC(2024, 3, 3)); // contoh H-7 Idulfitri

    it('masa kerja ≥ 12 bulan → THR penuh 1× upah', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2020, 0, 1)), referenceDate: raya });
      expect(r.eligible).toBe(true);
      expect(r.isProrated).toBe(false);
      expect(r.amount).toBe(6_000_000);
    });

    it('masa kerja 6 bulan → prorata (6/12 × upah)', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2023, 9, 3)), referenceDate: raya }); // 3 Okt 2023 → 3 Apr 2024 = 6 bln
      expect(r.tenureMonths).toBe(6);
      expect(r.isProrated).toBe(true);
      expect(r.amount).toBe(Math.round((6 / THR_MIN_MONTHS_FULL) * wage)); // 3.000.000
      expect(r.amount).toBe(3_000_000);
    });

    it('masa kerja < 1 bulan → tidak berhak', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2024, 2, 20)), referenceDate: raya });
      expect(r.eligible).toBe(false);
      expect(r.amount).toBe(0);
    });

    it('tepat 1 bulan → prorata 1/12', () => {
      const r = calculateThr({ monthlyWage: wage, joinDate: new Date(Date.UTC(2024, 2, 3)), referenceDate: raya }); // 3 Mar → 3 Apr = 1 bln
      expect(r.tenureMonths).toBe(1);
      expect(r.amount).toBe(Math.round((1 / 12) * wage)); // 500.000
    });
  });
});
