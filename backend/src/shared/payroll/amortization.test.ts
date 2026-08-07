import { generateAmortizationSchedule } from './amortization';

describe('amortization — pinjaman karyawan (hardening Employee-Loan)', () => {
  describe('FLAT — AC: 30jt, 6% p.a., 24 bulan', () => {
    const s = generateAmortizationSchedule({
      principal: 30_000_000,
      annualRatePercent: 6,
      tenorMonths: 24,
      method: 'FLAT',
    });

    it('menghasilkan 24 baris', () => {
      expect(s.rows).toHaveLength(24);
    });

    it('pokok 1.250.000 + bunga 150.000 = cicilan 1.400.000 per bulan', () => {
      expect(s.rows[0].principal).toBe(1_250_000);
      expect(s.rows[0].interest).toBe(150_000);
      expect(s.rows[0].total).toBe(1_400_000);
      expect(s.monthlyPaymentFlat).toBe(1_400_000);
    });

    it('total pokok = 30jt, total bunga = 3,6jt, total bayar = 33,6jt', () => {
      expect(s.totalPrincipal).toBe(30_000_000);
      expect(s.totalInterest).toBe(3_600_000);
      expect(s.totalPayment).toBe(33_600_000);
    });

    it('sisa pokok baris terakhir = 0', () => {
      expect(s.rows[23].remaining).toBe(0);
    });

    it('setelah 12 bulan, sisa pokok = 15jt (untuk pelunasan dipercepat)', () => {
      expect(s.rows[11].remaining).toBe(15_000_000);
    });
  });

  describe('EFFECTIVE — anuitas', () => {
    const s = generateAmortizationSchedule({
      principal: 12_000_000,
      annualRatePercent: 12,
      tenorMonths: 12,
      method: 'EFFECTIVE',
    });

    it('total cicilan bulanan relatif tetap & sisa akhir 0', () => {
      expect(s.rows).toHaveLength(12);
      expect(s.rows[11].remaining).toBe(0);
      // bunga menurun tiap bulan (dihitung dari sisa pokok)
      expect(s.rows[0].interest).toBeGreaterThan(s.rows[11].interest);
    });

    it('total bunga anuitas < total bunga flat untuk parameter sama', () => {
      const flat = generateAmortizationSchedule({
        principal: 12_000_000,
        annualRatePercent: 12,
        tenorMonths: 12,
        method: 'FLAT',
      });
      expect(s.totalInterest).toBeLessThan(flat.totalInterest);
    });
  });

  describe('bunga 0%', () => {
    it('cicilan = pokok / tenor, tanpa bunga', () => {
      const s = generateAmortizationSchedule({ principal: 6_000_000, annualRatePercent: 0, tenorMonths: 6 });
      expect(s.totalInterest).toBe(0);
      expect(s.rows[0].total).toBe(1_000_000);
    });
  });
});
