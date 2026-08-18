import {
  isSignatureStatusTransitionValid,
  validateSignerPayload,
  getRecommendedProvider,
  calculateDefaultExpiryDate,
} from './signature-wrapper';

const now = new Date(2026, 7, 18);

describe('D.3 E-Signature provider wrapper pure functions', () => {
  it('D.3 CASE1: FSM chain DRAFT→REQUESTED→SIGNED→VERIFIED → semua transisi valid.', () => {
    expect(isSignatureStatusTransitionValid('DRAFT', 'REQUESTED').allowed).toBe(true);
    expect(isSignatureStatusTransitionValid('REQUESTED', 'SIGNED').allowed).toBe(true);
    expect(isSignatureStatusTransitionValid('SIGNED', 'VERIFIED').allowed).toBe(true);
  });

  it('D.3 CASE2: Invalid dari SIGNED → kembali ke DRAFT = TIDAK BOLEH (rollback ditolak). VERIFIED = FINAL tidak ada outgoing transisi.', () => {
    expect(isSignatureStatusTransitionValid('SIGNED', 'DRAFT').allowed).toBe(false);
    expect(isSignatureStatusTransitionValid('SIGNED', 'DRAFT').reason).toMatch(/DRAFT/);
    expect(isSignatureStatusTransitionValid('VERIFIED', 'SIGNED').allowed).toBe(false);
    expect(isSignatureStatusTransitionValid('VERIFIED', 'EXPIRED').allowed).toBe(false);
  });

  it('D.3 CASE3: Validate signer payload: NIK 16 digit + email valid + HP 0812xxxx → valid=true, semuanya ter-normalisasi. NIK 15 digit invalid → errors length ≥1.', () => {
    const good = validateSignerPayload({
      signerNik: '3201010101010001',
      signerEmail: 'BOB@EXAMPLE.COM   ',
      signerPhone: '+62 812 3456 7890',
      fullName: 'Bob Santoso',
    });
    expect(good.valid).toBe(true);
    expect(good.normalizedNik).toBe('3201010101010001');
    expect(good.normalizedEmail).toBe('bob@example.com');
    expect(good.normalizedPhone).toBe('+62 812 3456 7890');
    expect(good.warnings.length).toBe(0);
    // NIK 15 digits (1 kurang)
    const bad = validateSignerPayload({ signerNik: '320101010101000' });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some(e => e.match(/16 digit/))).toBe(true);
  });

  it('D.3 CASE4: Decision matrix — needCertifiedLegal=true, preferGovernment=true → RECOMMEND PERURI (certified pemerintah). needAuditTrail + tidak certified → DIGISIGN (harga 12rb termurah certified).', () => {
    const peruri = getRecommendedProvider({ needCertifiedLegal: true, preferGovernment: true });
    expect(peruri.recommended).toBe('PERURI');
    expect(peruri.estimatedCostPerDocumentRupiah).toBe(25_000);
    const digisign = getRecommendedProvider({ needAuditTrail: true, budgetPerDocumentMaxRupiah: 15_000 });
    expect(digisign.recommended).toBe('DIGISIGN');
    expect(digisign.estimatedCostPerDocumentRupiah).toBe(12_000);
    // certified tanpa govt preference = PRIVY_ID
    const privy = getRecommendedProvider({ needCertifiedLegal: true });
    expect(privy.recommended).toBe('PRIVY_ID');
    expect(privy.estimatedCostPerDocumentRupiah).toBe(15_000);
  });

  it('D.3 CASE5: Expiry default 30 hari. 2026-08-18 requestedAt → expected 2026-09-17 (lewat 30 hari). INTERNAL provider cost=0. No req fallback = internal cost Rp. 0.', () => {
    const exp = calculateDefaultExpiryDate(now, 30);
    expect(exp.getFullYear()).toBe(2026);
    expect(exp.getMonth()).toBe(8); // September (0-indexed, August = 7, September = 8)
    expect(exp.getDate()).toBe(17); // 18 Aug + 30 hari = 17 September 2026 (August punya 31 hari. 18 Aug + 13 = 31 Aug, +17 = 17 Sep)
    const budgetZero = getRecommendedProvider({ budgetPerDocumentMaxRupiah: 0 });
    expect(budgetZero.recommended).toBe('INTERNAL');
    expect(budgetZero.estimatedCostPerDocumentRupiah).toBe(0);
    expect(budgetZero.cons.some(c => c.match(/NOT LEGAL|UU ITE/))).toBe(true);
  });

  it('D.3 CASE6: Budget certified but terbatas Rp13.000 — PRIVY_ID (15rb) melebihi budget → override → DIGISIGN (12rb) fallback. byPass admin=true → semua transisi force allowed.', () => {
    const r = getRecommendedProvider({ needCertifiedLegal: true, budgetPerDocumentMaxRupiah: 13_000 });
    expect(r.recommended).toBe('DIGISIGN'); // PRIVY 15rb melebihi 13rb → override ke 12rb DIGISIGN certified
    expect(r.estimatedCostPerDocumentRupiah).toBeLessThanOrEqual(13_000);
    // byPass VERIFIED→DRAFT bisa paksa:
    expect(isSignatureStatusTransitionValid('VERIFIED', 'DRAFT', { byPass: true }).allowed).toBe(true);
  });
});
