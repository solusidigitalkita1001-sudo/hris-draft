import { calculatePph21, computePtkp, taxOnPkp, Pph21Input } from './pph21';

describe('B.1 — PPh 21 Calculation Engine (UU HPP 2022, PTKP 2024)', () => {
  // ---------------- computePtkp (Tabel PTKP 8 combos) ----------------
  describe('computePtkp — Tahunan', () => {
    it('TK/0 = 54.000.000', () => {
      expect(computePtkp(false, 0)).toBe(54_000_000);
    });
    it('K/0 = 58.500.000 (base + 1 spouse step)', () => {
      expect(computePtkp(true, 0)).toBe(58_500_000);
    });
    it('K/1 = 63.000.000 (spouse + 1 dep)', () => {
      expect(computePtkp(true, 1)).toBe(63_000_000);
    });
    it('K/2 = 67.500.000 (spouse + 2 dep)', () => {
      expect(computePtkp(true, 2)).toBe(67_500_000);
    });
    it('K/3 = 72.000.000 (MAX dependents, pasangan + 3 anak)', () => {
      expect(computePtkp(true, 3)).toBe(72_000_000);
    });
    it('dependents >3 otomatis cap 3 (rule MAX_DEPENDENTS)', () => {
      expect(computePtkp(true, 5)).toBe(72_000_000);
    });
    it('dependents <0 otomatis 0 (negative guard)', () => {
      expect(computePtkp(false, -2)).toBe(54_000_000);
    });
  });

  // ---------------- taxOnPkp (Tarif Progresif 5 tiers) ----------------
  describe('taxOnPkp — Tarif PKP TAHUNAN progresif', () => {
    it('PKP 0 = pajak 0', () => {
      expect(taxOnPkp(0)).toBe(0);
    });
    it('PKP 60jt (batas tier 1): 60jt × 5% = 3.000.000', () => {
      expect(taxOnPkp(60_000_000)).toBe(3_000_000);
    });
    it('PKP 30jt (tier 1 bawah ambang): 30jt ×5% = 1,5jt', () => {
      expect(taxOnPkp(30_000_000)).toBe(1_500_000);
    });
    it('PKP 250jt (batas tier 2): 60×5% + 190×15% = 3jt + 28,5jt = 31,5jt', () => {
      // tier1 60jt×5%=3jt ; tier2 190jt×15%=28.500.000 → total 31.500.000
      expect(taxOnPkp(250_000_000)).toBe(31_500_000);
    });
    it('PKP 500jt (batas tier3): 3jt + 28.5jt + 250jt×25% = 31,5jt + 62,5jt = 94jt', () => {
      expect(taxOnPkp(500_000_000)).toBe(94_000_000);
    });
    it('PKP 5M (batas tier4): 94jt + 4.5M×30% = 94jt + 1.350.000.000 = 1.444.000.000', () => {
      expect(taxOnPkp(5_000_000_000)).toBe(1_444_000_000);
    });
    it('PKP negatif (input kotor di bawah PTKP) — safe guard 0', () => {
      expect(taxOnPkp(-5_000_000)).toBe(0);
    });
  });

  // ---------------- calculatePph21 — END-TO-END bulanan ----------------
  describe('calculatePph21 — bulanan (annualized method)', () => {
    const baseTK0: Pph21Input = {
      monthlyGross: 0,
      married: false,
      dependents: 0,
      monthlyPensionContribution: 0,
      hasNpwp: true,
    };

    it('gross monthly 0 → pajak 0', () => {
      const r = calculatePph21({ ...baseTK0, monthlyGross: 0 });
      expect(r.monthlyTax).toBe(0);
    });

    it('CASE A: TK/0 gross 6.000.000/month, tanpa pension → TK/0 PKP 14,4jt annual, pajak 720rb annual', () => {
      // Monthly Gross: 6jt. Biaya Jabatan = 5% × 6jt = 300rb/bulan (bawah cap 500rb).
      // Monthly Net = 6jt - 300rb = 5.700.000.
      // Annual ×12 = 68.400.000.
      // PTKP TK/0 = 54jt. PKP = floor((68,4 - 54)jt / 1000)*1000 = 14.400.000.
      // PKP 14,4jt × 5% (tier 1) = 720.000 annual.
      // Monthly: round(720.000 / 12) = 60.000.
      const r = calculatePph21({
        ...baseTK0,
        monthlyGross: 6_000_000,
      });
      expect(r.ptkp).toBe(54_000_000);
      expect(r.annualNet).toBe(68_400_000);
      expect(r.pkp).toBe(14_400_000);
      expect(r.annualTax).toBe(720_000);
      expect(r.monthlyTax).toBe(60_000);
    });

    it('CASE B: TK/0 gross 15jt/month, pension 3% (JHT 2% + JP 1%) = 450rb', () => {
      // Monthly: Gross 15jt, BJ 5%×15jt = 750rb (capped dibawah 500rb? NO 5%×15=750rb > 500rb max → BJ=500rb).
      // Net monthly = 15jt - 500rb - 450rb = 14.050.000 → annual ×12 = 168.600.000.
      // PKP 168.6jt - 54jt = 114.600.000 → floor 1000 = 114.600.000.
      // Tier1 60jt×5%=3jt ; sisa 54,6jt×15%=8,19jt → 11,19jt annual.
      // Monthly: round(11.190.000 / 12) = 932.500
      const r = calculatePph21({
        ...baseTK0,
        monthlyGross: 15_000_000,
        monthlyPensionContribution: 450_000,
      });
      expect(r.ptkp).toBe(54_000_000);
      expect(r.annualNet).toBe(168_600_000);
      expect(r.pkp).toBe(114_600_000);
      expect(r.annualTax).toBe(11_190_000);
      expect(r.monthlyTax).toBe(932_500);
    });

    it('CASE C: Biaya Jabatan cap 500rb/month (jika 5% × gross > 500rb)', () => {
      // gross 20jt → BJ%=1jt > max 500rb → BJ 500rb/mo
      const rBJSmall = calculatePph21({ ...baseTK0, monthlyGross: 5_000_000 });
      // 5j×5%=250rb <500rb → BJ=250rb per bulan
      expect(rBJSmall.annualNet).toBe((5_000_000 - 250_000) * 12);
      const rBJCap = calculatePph21({ ...baseTK0, monthlyGross: 30_000_000 });
      // BJ cap 500rb/mo
      expect(rBJCap.annualNet).toBe((30_000_000 - 500_000) * 12);
    });

    it('CASE D: TANPA NPWP → 20% SURCHARGE pajak (bandingkan dengan case A yang sama)', () => {
      const withNpwp = calculatePph21({ ...baseTK0, monthlyGross: 6_000_000, hasNpwp: true });
      const noNpwp = calculatePph21({ ...baseTK0, monthlyGross: 6_000_000, hasNpwp: false });
      // CASE A annual tax: 720rb × 1.2 = 864.000 → monthly 864.000/12 = 72.000
      expect(noNpwp.annualTax).toBe(Math.round(720_000 * 1.2));
      expect(noNpwp.annualTax).toBe(864_000);
      expect(noNpwp.monthlyTax).toBe(72_000);
      expect(noNpwp.monthlyTax).toBeGreaterThan(withNpwp.monthlyTax);
    });

    it('CASE E: K/3 (menikah 3 tanggungan) gross 20jt/month, pension 600rb', () => {
      // monthly: 20jt - BJ cap 500rb - 600rb = 18,9jt → annual 226.800.000
      // PTKP K/3 = 72jt. PKP = floor((226,8 - 72)jt) = 154.800.000.
      // tier1 60×5%=3jt; sisa 94,8jt×15%=14.220.000 → annual=17.220.000. monthly=1.435.000
      const r = calculatePph21({
        monthlyGross: 20_000_000,
        married: true,
        dependents: 3,
        monthlyPensionContribution: 600_000,
        hasNpwp: true,
      });
      expect(r.ptkp).toBe(72_000_000);
      expect(r.pkp).toBe(154_800_000);
      expect(r.annualTax).toBe(17_220_000);
      expect(r.monthlyTax).toBe(1_435_000);
    });

    it('CASE F: gross 5 juta, TK/0 → PKP floor 1000 rupiah per aturan DJP', () => {
      const r = calculatePph21({ ...baseTK0, monthlyGross: 5_500_000 });
      // AnnNet = (5,5jt - (5%×5.5=275rb))×12 = 5.225.000 ×12 = 62.700.000
      // PKP = 62,7 - 54 = 8,7jt → floor 1000 = 8.700.000
      expect(r.pkp % 1000).toBe(0);
      expect(r.pkp).toBe(8_700_000);
    });

    it('CASE G: negative input gross — max(0,gross) safe guard. pajak 0.', () => {
      const r = calculatePph21({ ...baseTK0, monthlyGross: -2_000_000 });
      expect(r.monthlyTax).toBe(0);
      expect(r.annualNet).toBe(0);
    });
  });
});
