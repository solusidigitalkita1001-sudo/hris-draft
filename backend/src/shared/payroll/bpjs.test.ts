import { calculateBpjs, DEFAULT_BPJS_CONFIG, BpjsBreakdown } from './bpjs';

describe('B.3 — BPJS TK & Kesehatan Tiered Engine (Permenaker/HR 2024)', () => {
  describe('DEFAULT CONFIG — sanity numbers (JKK risk class I kantoran)', () => {
    it('defaults match aturan: JKK I 0.24%, JKM 0.30%, JHT E 3.7 + K 2.0, JP 2+1 capped, JKN 4+1 capped', () => {
      expect(DEFAULT_BPJS_CONFIG.jkkRatePercent).toBe(0.24);
      expect(DEFAULT_BPJS_CONFIG.jkmRatePercent).toBe(0.30);
      expect(DEFAULT_BPJS_CONFIG.jpWageCap).toBe(10_547_400);
      expect(DEFAULT_BPJS_CONFIG.jknWageCap).toBe(12_000_000);
    });
  });

  // ---------------- SPLIT employee vs employer ----------------
  describe('employee portion (JHT 2%, JP 1%, JKN 1%) — tanpa cap', () => {
    // UPAH 5.000.000 (dibawah kedua cap JP=10,5M & JKN=12M → tanpa cap)
    const wage = 5_000_000;
    it(`employee JHT 2% dari ${wage} = 100.000`, () => {
      const r = calculateBpjs(wage);
      expect(r.employee.jht).toBe(100_000);
    });
    it(`employee JP 1% dari ${wage} = 50.000`, () => {
      expect(calculateBpjs(wage).employee.jp).toBe(50_000);
    });
    it(`employee JKN 1% dari ${wage} = 50.000`, () => {
      expect(calculateBpjs(wage).employee.jkn).toBe(50_000);
    });
    it('TOTAL employee potongan gaji = 100+50+50 = 200.000', () => {
      expect(calculateBpjs(wage).employee.total).toBe(200_000);
    });
  });

  describe('employer portion — JKK risk I + JKM 0.3% + JHT 3.7% + JP 2% + JKN4%', () => {
    const wage = 5_000_000;
    let r: BpjsBreakdown;
    beforeAll(() => { r = calculateBpjs(wage); });
    it('JKK 0.24% = 12.000', () => expect(r.employer.jkk).toBe(12_000));
    it('JKM 0.30% = 15.000', () => expect(r.employer.jkm).toBe(15_000));
    it('JHT employer 3.7% = 185.000', () => expect(r.employer.jht).toBe(185_000));
    it('JP employer 2% = 100.000', () => expect(r.employer.jp).toBe(100_000));
    it('JKN employer 4% = 200.000', () => expect(r.employer.jkn).toBe(200_000));
    it('TOTAL employer = 12+15+185+100+200 = 512.000', () => {
      expect(r.employer.total).toBe(512_000);
    });
  });

  // ---------------- TIERED JKK RISK CLASS (I s/d V) ----------------
  describe('JKK TIERED per risk class — 50 juta upah (high payroll)', () => {
    const wage = 50_000_000;
    it('Risk I (0.24%) → JKK employer = 50M × 0.24% = 120.000', () => {
      expect(calculateBpjs(wage, { jkkRatePercent: 0.24 }).employer.jkk).toBe(120_000);
    });
    it('Risk II (0.54%) → 270.000', () => {
      expect(calculateBpjs(wage, { jkkRatePercent: 0.54 }).employer.jkk).toBe(270_000);
    });
    it('Risk III (0.89%) → 445.000', () => {
      expect(calculateBpjs(wage, { jkkRatePercent: 0.89 }).employer.jkk).toBe(445_000);
    });
    it('Risk IV (1.27%) → 635.000', () => {
      expect(calculateBpjs(wage, { jkkRatePercent: 1.27 }).employer.jkk).toBe(635_000);
    });
    it('Risk V HIGH LOGISTIC/EXCAVATION (1.74%) → 870.000', () => {
      expect(calculateBpjs(wage, { jkkRatePercent: 1.74 }).employer.jkk).toBe(870_000);
    });
  });

  // ---------------- UPAAH CAPS JP & JKN ----------------
  describe('JP WAGE CAP 10.547.400 — upah 50JT, JP dihitung base 10,547,400 SAJA', () => {
    const wage = 50_000_000;
    const capped = DEFAULT_BPJS_CONFIG.jpWageCap; // 10.547.400
    it('employee JP = capped ×1% = round(105.474) = 105.474', () => {
      // 1% × 10.547.400 = 105.474 exactly (round(x)=x, bilangan bulat 100×1054.74 → 105,474)
      expect(Math.round(capped * 0.01)).toBe(105_474);
      expect(calculateBpjs(wage).employee.jp).toBe(Math.round(capped * 0.01));
    });
    it('employer JP = capped ×2% = 210.948', () => {
      expect(calculateBpjs(wage).employer.jp).toBe(Math.round(capped * 0.02));
    });
    it(`JHT employee = 2% × 50JT = 1jt (JHT TIDAK DI-CAP — cuma JP & JKN cap)`, () => {
      expect(calculateBpjs(wage).employee.jht).toBe(1_000_000);
    });
  });

  describe('JKN WAGE CAP 12jt — upah 50JT JKN base CUMAN 12JT', () => {
    const wage = 50_000_000;
    it('employee JKN = 12jt ×1% = 120.000', () => {
      expect(calculateBpjs(wage).employee.jkn).toBe(120_000);
    });
    it('employer JKN = 12jt ×4% = 480.000', () => {
      expect(calculateBpjs(wage).employer.jkn).toBe(480_000);
    });
  });

  describe('custom cap override via partial config (future-proofing)', () => {
    it('jika custom jpWageCap = 8jt → employee JP = 1%×8jt = 80.000', () => {
      expect(calculateBpjs(50_000_000, { jpWageCap: 8_000_000 }).employee.jp).toBe(80_000);
    });
  });

  // ---------------- EDGE CASES ----------------
  describe('edge cases / safe guards', () => {
    it('upah NEGATIVE / input kotor = 0 semua breakdown', () => {
      const r = calculateBpjs(-5_000_000);
      expect(r.employee.total).toBe(0);
      expect(r.employer.total).toBe(0);
    });
    it('upah 0 → semua nol', () => {
      const r = calculateBpjs(0);
      expect(r.employee.jht + r.employee.jp + r.employee.jkn).toBe(0);
    });
    it('custom JKM rate = 0% (testing config: JKM employer nolkan) → employer JKM 0', () => {
      const r = calculateBpjs(5_000_000, { jkmRatePercent: 0 });
      expect(r.employer.jkm).toBe(0);
    });
    it('TOTAL perusahaan > TOTAL karyawan (rule thumb: perusahaan selalu nanggung porsi lebih besar)', () => {
      const r5 = calculateBpjs(5_000_000);
      const r25 = calculateBpjs(25_000_000);
      const r100 = calculateBpjs(100_000_000);
      expect(r5.employer.total).toBeGreaterThan(r5.employee.total);
      expect(r25.employer.total).toBeGreaterThan(r25.employee.total);
      expect(r100.employer.total).toBeGreaterThan(r100.employee.total);
    });
  });
});
