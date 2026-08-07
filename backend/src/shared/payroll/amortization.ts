/**
 * Amortisasi cicilan pinjaman karyawan (hardening Business Rule Gap modul Employee-Loan).
 *
 * Mendukung 2 metode bunga:
 *   - FLAT      : bunga dihitung dari pokok awal, tetap tiap bulan.
 *                 bunga/bulan = pokokAwal × (rateTahunan/100) / 12
 *                 pokok/bulan = pokokAwal / tenor
 *   - EFFECTIVE : anuitas — bunga dihitung dari sisa pokok (menurun), total cicilan tetap.
 *
 * Semua fungsi PURE (tanpa DB).
 */

export type AmortizationMethod = 'FLAT' | 'EFFECTIVE';

export interface AmortizationRow {
  month: number; // 1..tenor
  principal: number; // bagian pokok
  interest: number; // bagian bunga
  total: number; // cicilan bulan ini (pokok + bunga)
  remaining: number; // sisa pokok setelah bayar bulan ini
}

export interface AmortizationScheduleInput {
  principal: number;
  /** Suku bunga tahunan dalam persen (mis. 6 untuk 6% p.a.). */
  annualRatePercent: number;
  tenorMonths: number;
  method?: AmortizationMethod;
}

export interface AmortizationSchedule {
  method: AmortizationMethod;
  monthlyPaymentFlat?: number; // hanya untuk FLAT (konstan)
  totalPrincipal: number;
  totalInterest: number;
  totalPayment: number;
  rows: AmortizationRow[];
}

export function generateAmortizationSchedule(input: AmortizationScheduleInput): AmortizationSchedule {
  const method = input.method ?? 'FLAT';
  const { principal, tenorMonths } = input;
  const monthlyRate = input.annualRatePercent / 100 / 12;

  if (tenorMonths <= 0) {
    return { method, totalPrincipal: 0, totalInterest: 0, totalPayment: 0, rows: [] };
  }

  const rows: AmortizationRow[] = [];
  let remaining = principal;

  if (method === 'FLAT') {
    const basePrincipal = Math.floor(principal / tenorMonths);
    const monthlyInterest = Math.round(principal * monthlyRate);

    for (let m = 1; m <= tenorMonths; m++) {
      // Bulan terakhir menyerap sisa pembulatan pokok agar remaining tepat 0.
      const principalPart = m === tenorMonths ? remaining : basePrincipal;
      remaining = Math.max(0, remaining - principalPart);
      rows.push({
        month: m,
        principal: principalPart,
        interest: monthlyInterest,
        total: principalPart + monthlyInterest,
        remaining,
      });
    }
  } else {
    // EFFECTIVE / anuitas.
    const payment =
      monthlyRate === 0
        ? principal / tenorMonths
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -tenorMonths));

    for (let m = 1; m <= tenorMonths; m++) {
      const interest = Math.round(remaining * monthlyRate);
      let principalPart = Math.round(payment) - interest;
      if (m === tenorMonths) principalPart = remaining; // serap sisa di bulan terakhir
      remaining = Math.max(0, remaining - principalPart);
      rows.push({
        month: m,
        principal: principalPart,
        interest,
        total: principalPart + interest,
        remaining,
      });
    }
  }

  const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);

  return {
    method,
    monthlyPaymentFlat: method === 'FLAT' ? rows[0]?.total : undefined,
    totalPrincipal,
    totalInterest,
    totalPayment: totalPrincipal + totalInterest,
    rows,
  };
}
