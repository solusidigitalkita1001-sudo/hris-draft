import {
  calculateProratedEntitlement,
  calculateCarryOver,
  calculateOpeningBalance,
  daysInYear,
} from './accrual';

describe('leave accrual — pro-rate & carry-over (Business Rule Gap hardening)', () => {
  describe('daysInYear', () => {
    it('mengembalikan 366 untuk tahun kabisat dan 365 untuk tahun biasa', () => {
      expect(daysInYear(2024)).toBe(366); // kabisat
      expect(daysInYear(2023)).toBe(365);
      expect(daysInYear(2000)).toBe(366); // kelipatan 400
      expect(daysInYear(1900)).toBe(365); // kelipatan 100 bukan 400
    });
  });

  describe('Skenario 1 — join di pertengahan tahun (pro-rate floor)', () => {
    it('Budi join 15 April 2023, kuota 12 → 8 hari (floor)', () => {
      const result = calculateProratedEntitlement({
        joinDate: new Date(Date.UTC(2023, 3, 15)), // 15 April 2023
        year: 2023,
        annualQuota: 12,
      });
      // 15 Apr–31 Des 2023 = 261 hari → floor(261/365 × 12) = floor(8,58) = 8
      expect(result).toBe(8);
    });

    it('karyawan yang sudah bergabung sebelum tahun target dapat kuota penuh', () => {
      const result = calculateProratedEntitlement({
        joinDate: new Date(Date.UTC(2020, 0, 1)),
        year: 2024,
        annualQuota: 12,
      });
      expect(result).toBe(12);
    });

    it('karyawan yang belum bergabung pada tahun target mendapat 0', () => {
      const result = calculateProratedEntitlement({
        joinDate: new Date(Date.UTC(2025, 5, 1)),
        year: 2024,
        annualQuota: 12,
      });
      expect(result).toBe(0);
    });
  });

  describe('Skenario 2 — carry-over dibatasi maksimum', () => {
    it('sisa 5 hari dengan max carry-over 1 → hanya 1 hari terbawa', () => {
      expect(calculateCarryOver({ previousRemaining: 5, maxCarryOver: 1 })).toBe(1);
    });

    it('sisa 0/negatif → 0', () => {
      expect(calculateCarryOver({ previousRemaining: 0 })).toBe(0);
      expect(calculateCarryOver({ previousRemaining: -3 })).toBe(0);
    });

    it('default max carry-over adalah 1 hari', () => {
      expect(calculateCarryOver({ previousRemaining: 10 })).toBe(1);
    });
  });

  describe('Skenario 3 — opening balance tahun berjalan = entitlement penuh + carry-over', () => {
    it('Budi 2024 (full 12) + carry-over 1 dari sisa 5 tahun 2023 → total 13', () => {
      const result = calculateOpeningBalance({
        joinDate: new Date(Date.UTC(2023, 3, 15)),
        year: 2024,
        annualQuota: 12,
        previousRemaining: 5,
        maxCarryOver: 1,
      });
      expect(result.entitlement).toBe(12);
      expect(result.carryOver).toBe(1);
      expect(result.totalDays).toBe(13);
    });

    it('resign pertengahan: join 15 April 2023, evaluasi tahun 2023 = 8 + carry 0', () => {
      const result = calculateOpeningBalance({
        joinDate: new Date(Date.UTC(2023, 3, 15)),
        year: 2023,
        annualQuota: 12,
        previousRemaining: 0,
      });
      expect(result.entitlement).toBe(8);
      expect(result.totalDays).toBe(8);
    });
  });
});
