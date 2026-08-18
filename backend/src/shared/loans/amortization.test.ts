import { generateLoanInstallmentSchedule } from './amortization';

describe('C.2 loan amortization schedule (FLAT/EFEKTIF/ANUITAS)', () => {
  it('C.2 CASE1: FLAT 12jt tenor 12 bulan, bunga 12%/tahun. Cicilan pokok 1jt/bln + bunga 120rb/bln FLAT (rate pokok tetap total). Jumlah cicilan tepat 12 row', () => {
    const sched = generateLoanInstallmentSchedule({
      principalAmount: 12_000_000,
      totalInstallments: 12,
      interestRatePercentPerYear: 12,
      method: 'FLAT',
      disbursementDate: new Date(2026, 0, 15),
      firstDueDate: new Date(2026, 1, 15),
    });
    expect(sched.rows.length).toBe(12);
    expect(sched.method).toBe('FLAT');
    expect(sched.totalPrincipal).toBe(12_000_000);
    // bunga flat 12% per tahun = 1% per bulan => 12juta * 1% = 120rb/bln * 12 bulan = 1.440.000 total bunga
    expect(sched.totalInterest).toBeCloseTo(1_440_000, -1);
    expect(sched.rows[0].principal).toBeCloseTo(1_000_000, -1);
    expect(sched.rows[0].interest).toBeCloseTo(120_000, -1);
    // remaining principal after row 0 = 12jt - 1jt = 11jt
    expect(sched.rows[0].remainingPrincipalAfter).toBeCloseTo(11_000_000, -1);
    // last row remaining after = 0
    expect(sched.rows[11].remainingPrincipalAfter).toBe(0);
  });

  it('C.2 CASE2: EFEKTIF bunga 12%/tahun tenor 12 bulan 12jt. Bunga bulan pertama (rem 12jt * 1% = 120rb) > bulan terakhir (rem 1jt * 1% = 10rb) DECREASING', () => {
    const sched = generateLoanInstallmentSchedule({
      principalAmount: 12_000_000,
      totalInstallments: 12,
      interestRatePercentPerYear: 12,
      method: 'EFEKTIF',
      disbursementDate: '2026-01-15',
      firstDueDate: '2026-02-15',
    });
    expect(sched.rows[0].interest).toBeGreaterThan(sched.rows[11].interest);
    expect(sched.rows[0].interest).toBeCloseTo(120_000, -1);
    const lastInterest = sched.rows[11].interest;
    // bunga terakhir sisa pokok 1jt * 1% = ~10rb
    expect(lastInterest).toBeGreaterThanOrEqual(8_000);
    expect(lastInterest).toBeLessThanOrEqual(15_000);
  });

  it('C.2 CASE3: ANUITAS bunga 12%/tahun tenor 12 bulan 12jt. Total per bulan KONSTAN (sama) kecuali terakhir (penyesuaian rounding).', () => {
    const sched = generateLoanInstallmentSchedule({
      principalAmount: 12_000_000,
      totalInstallments: 12,
      interestRatePercentPerYear: 12,
      method: 'ANUITAS',
    });
    const firstAmt = sched.rows[0].totalAmount;
    const secondAmt = sched.rows[1].totalAmount;
    // first 11 bulannya konstan (delta < 1 rupiah rounding)
    expect(Math.abs(firstAmt - secondAmt)).toBeLessThanOrEqual(1);
    expect(sched.rows[11].remainingPrincipalAfter).toBe(0);
  });

  it('C.2 CASE4: tenor 0 / tenor null => auto cuma 1 cicilan jatuh tempo = 1 bulan. No crash guard.', () => {
    const sched0 = generateLoanInstallmentSchedule({
      principalAmount: 5_000_000,
      totalInstallments: 0,
      interestRatePercentPerYear: 0,
    });
    expect(sched0.rows.length).toBe(1);
    expect(sched0.rows[0].principal).toBe(5_000_000);
    expect(sched0.totalInterest).toBe(0);
    // bunga 0 total payment = principal
    expect(sched0.totalPayment).toBe(sched0.totalPrincipal);
    // negative principal => clamp 0
    const neg = generateLoanInstallmentSchedule({ principalAmount: -2000, totalInstallments: 3, interestRatePercentPerYear: 0 });
    expect(neg.totalPrincipal).toBe(0);
    expect(neg.rows[0].principal).toBe(0);
  });

  it('C.2 CASE5: total cicilan = total principal + total interest (check rounding sum).', () => {
    const s = generateLoanInstallmentSchedule({
      principalAmount: 25_000_000,
      totalInstallments: 24,
      interestRatePercentPerYear: 15,
      method: 'FLAT',
    });
    const sumRows = s.rows.reduce((acc, r) => acc + r.totalAmount, 0);
    expect(Math.abs(sumRows - s.totalPayment)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(s.totalPayment - (s.totalPrincipal + s.totalInterest))).toBeLessThanOrEqual(0.05);
  });
});
