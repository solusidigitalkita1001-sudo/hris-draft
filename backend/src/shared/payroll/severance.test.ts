import {
  calculateSeverance,
  severanceMonths,
  longServiceMonths,
  calculateTenureYears,
} from './severance';

describe('severance — UU 13/2003 Pasal 156 (hardening Business Rule Gap Onboarding/Exit)', () => {
  describe('tabel Uang Pesangon — Pasal 156 ayat (2)', () => {
    it('mengikuti tabel resmi (n+1 bulan, maks 9)', () => {
      expect(severanceMonths(0.5)).toBe(1); // < 1 tahun
      expect(severanceMonths(1)).toBe(2);
      expect(severanceMonths(4)).toBe(5);
      expect(severanceMonths(7)).toBe(8);
      expect(severanceMonths(8)).toBe(9);
      expect(severanceMonths(20)).toBe(9); // cap 9 bulan
    });
  });

  describe('tabel UPMK — Pasal 156 ayat (3)', () => {
    it('0 jika < 3 tahun, lalu naik per kelipatan 3 tahun (maks 10)', () => {
      expect(longServiceMonths(2)).toBe(0);
      expect(longServiceMonths(3)).toBe(2);
      expect(longServiceMonths(6)).toBe(3);
      expect(longServiceMonths(9)).toBe(4);
      expect(longServiceMonths(12)).toBe(5);
      expect(longServiceMonths(24)).toBe(10);
      expect(longServiceMonths(30)).toBe(10); // cap
    });
  });

  describe('Skenario AC — 3 kasus', () => {
    const wage = 8_000_000;

    it('PHK masa kerja 10 tahun: UP 9 bln + UPMK 4 bln (faktor 1×)', () => {
      const r = calculateSeverance({
        monthlyWage: wage,
        joinDate: new Date(Date.UTC(2014, 0, 1)),
        endDate: new Date(Date.UTC(2024, 0, 1)),
        reason: 'TERMINATION',
      });
      expect(Math.floor(r.tenureYears)).toBe(10);
      expect(r.severanceMonths).toBe(9);
      expect(r.longServiceMonths).toBe(4);
      // UP = 9 × 8jt = 72jt ; UPMK = 4 × 8jt = 32jt
      expect(r.severancePay).toBe(72_000_000);
      expect(r.longServicePay).toBe(32_000_000);
      expect(r.total).toBe(104_000_000);
    });

    it('RESIGN masa kerja 2 tahun: tanpa UP/UPMK, hanya UPH + uang cuti', () => {
      const r = calculateSeverance({
        monthlyWage: wage,
        joinDate: new Date(Date.UTC(2022, 0, 1)),
        endDate: new Date(Date.UTC(2024, 0, 1)),
        reason: 'RESIGN',
        unusedLeaveDays: 2,
        monthlyWorkingDays: 22,
      });
      expect(r.severancePay).toBe(0);
      expect(r.longServicePay).toBe(0);
      // uang cuti = 8jt/22 × 2 = 727.273 (dibulatkan)
      expect(r.leaveCompensation).toBe(Math.round((wage / 22) * 2));
      expect(r.total).toBe(r.leaveCompensation);
    });

    it('PKWT selesai (CONTRACT_END): tanpa UP/UPMK; kompensasi diterima via UPH', () => {
      const r = calculateSeverance({
        monthlyWage: wage,
        joinDate: new Date(Date.UTC(2023, 0, 1)),
        endDate: new Date(Date.UTC(2024, 0, 1)),
        reason: 'CONTRACT_END',
        compensationOfRights: 8_000_000, // uang kompensasi PKWT 1 tahun ≈ 1 bulan upah
      });
      expect(r.severancePay).toBe(0);
      expect(r.longServicePay).toBe(0);
      expect(r.compensationOfRights).toBe(8_000_000);
      expect(r.total).toBe(8_000_000);
    });
  });

  describe('faktor alasan khusus', () => {
    it('pensiun memakai faktor UP 1,75×', () => {
      const r = calculateSeverance({
        monthlyWage: 10_000_000,
        joinDate: new Date(Date.UTC(2000, 0, 1)),
        endDate: new Date(Date.UTC(2024, 0, 1)),
        reason: 'RETIREMENT',
      });
      // UP 9 bln × 10jt × 1,75 = 157,5jt
      expect(r.severancePay).toBe(157_500_000);
    });
  });

  describe('calculateTenureYears', () => {
    it('menghitung masa kerja desimal dari selisih hari', () => {
      const y = calculateTenureYears(new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2024, 0, 1)));
      expect(Math.floor(y)).toBe(4);
    });
  });
});
