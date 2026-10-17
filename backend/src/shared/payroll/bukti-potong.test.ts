import {
  buildForm1721VII, buildForm1721VIII, formatBuktiPotongNumberFor, severanceTopRatePercent,
} from './bukti-potong';

describe('bukti potong numbers', () => {
  it('formats per form code: 1.5 monthly, 1.4 final', () => {
    expect(formatBuktiPotongNumberFor('1721-VIII', 1, 2026, 1)).toBe('1.5-01.26-0000001');
    expect(formatBuktiPotongNumberFor('1721-VII', 11, 2026, 42)).toBe('1.4-11.26-0000042');
    expect(formatBuktiPotongNumberFor('1721-VI', 7, 2027, 9_999_999)).toBe('1.3-07.27-9999999');
  });

  it('rejects an impossible month or sequence', () => {
    expect(() => formatBuktiPotongNumberFor('1721-VIII', 13, 2026, 1)).toThrow(/1\.\.12/);
    expect(() => formatBuktiPotongNumberFor('1721-VIII', 1, 2026, 0)).toThrow(/Sequence/);
  });
});

describe('1721-VIII (bulanan)', () => {
  it('writes masa mm-yyyy, DPP defaults to bruto, and derives the applied rate from frozen figures', () => {
    const form = buildForm1721VIII({ taxMonth: 3, taxYear: 2026, bruto: 10_000_000, pphDipotong: 250_000, hasNpwp: true });
    expect(form.masaPajak).toBe('03-2026');
    expect(form.dasarPengenaanPajak).toBe(10_000_000);
    // 250.000 / 10.000.000 = 2,5% — tarif yang benar-benar diterapkan.
    expect(form.tarifPercent).toBe(2.5);
    expect(form.tanpaNpwp).toBe(false);
    expect(form.taxObjectCode).toBe('21-100-01');
  });

  it('marks the no-NPWP box and keeps rupiah whole', () => {
    const form = buildForm1721VIII({ taxMonth: 12, taxYear: 2026, bruto: 5_000_000.49, pphDipotong: 0, hasNpwp: false });
    expect(form.tanpaNpwp).toBe(true);
    expect(form.bruto).toBe(5_000_000);
    expect(form.tarifPercent).toBe(0);
  });
});

describe('1721-VII (final, pesangon)', () => {
  it.each([
    [0, 0], [40_000_000, 0], [50_000_000, 0], [80_000_000, 5], [100_000_000, 5],
    [300_000_000, 15], [600_000_000, 25],
  ])('cumulative gross %d → tarif tertinggi %d%%', (gross, rate) => {
    expect(severanceTopRatePercent(gross)).toBe(rate);
  });

  it('uses the CUMULATIVE gross for the top rate — a second instalment keeps climbing (PP 68/2009 pasal 2(2))', () => {
    const form = buildForm1721VII({
      taxMonth: 10, taxYear: 2026, bruto: 60_000_000, pphDipotong: 2_000_000, cumulativeGross: 120_000_000,
    });
    expect(form.tarifPercent).toBe(15);
    expect(form.taxObjectCode).toBe('21-401-01');
    expect(form.masaPajak).toBe('10-2026');
  });

  it('a first instalment entirely inside the 0% band is legitimate and flagged for a human eye', () => {
    const form = buildForm1721VII({ taxMonth: 10, taxYear: 2026, bruto: 80_000_000, pphDipotong: 0 });
    expect(form.tarifPercent).toBe(5);
    expect(form.warnings).toContain('form:ZERO_TAX_AT_NONZERO_RATE');
  });
});
