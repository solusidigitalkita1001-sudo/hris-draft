import {
  validateBarcodeFormat,
  normalizeBarcode,
  patrolComplianceRate,
  conditionToNumeric,
  numericToCondition,
  isValidConditionRating,
} from './asset-patrol';

describe('C.7 Asset Patrol pure functions', () => {
  it('C.7 CASE1: 10 required assets, 8 done = 80% compliance (persis). missed 2 = correct ids.', () => {
    const required = ['AST-00001', 'AST-00002', 'AST-00003', 'AST-00004', 'AST-00005', 'AST-00006', 'AST-00007', 'AST-00008', 'AST-00009', 'AST-00010'];
    const done = ['AST-00001', 'AST-00002', 'AST-00003', 'AST-00004', 'AST-00005', 'AST-00006', 'AST-00007', 'AST-00008'];
    const r = patrolComplianceRate(required, done);
    expect(r.totalRequired).toBe(10);
    expect(r.totalCompleted).toBe(8);
    expect(r.totalMissed).toBe(2);
    expect(r.compliancePercent).toBe(80);
    expect(r.missedAssetIds).toEqual(['AST-00009', 'AST-00010']);
  });

  it('C.7 CASE2: validateBarcodeFormat default prefix AST-, AST-00123 = valid (5 digit numeric). code = 00123.', () => {
    const v = validateBarcodeFormat('AST-00123');
    expect(v.valid).toBe(true);
    expect(v.prefix).toBe('AST-');
    expect(v.code).toBe('00123');
  });

  it('C.7 CASE3: invalid barcode format. barcode-123 prefix salah → invalid; AST-AB1 digit bukan angka → invalid; AST-00 cuma 2 digit < minD 3 → invalid.', () => {
    expect(validateBarcodeFormat('barcode-123').valid).toBe(false);
    expect(validateBarcodeFormat('AST-AB1').valid).toBe(false);
    expect(validateBarcodeFormat('AST-00').valid).toBe(false);
    expect(validateBarcodeFormat('').valid).toBe(false);
    expect(validateBarcodeFormat(null).valid).toBe(false);
  });

  it('C.7 CASE4: 100% if all scanned, completionRate = 1 (persis). Required 5 → scanned 5 = 100%.', () => {
    const req = ['AST-001', 'AST-002', 'AST-003', 'AST-004', 'AST-005'];
    const done = [...req];
    const r = patrolComplianceRate(req, done);
    expect(r.compliancePercent).toBe(100);
    expect(r.completionRate).toBe(1);
    expect(r.totalMissed).toBe(0);
    expect(r.missedAssetIds.length).toBe(0);
  });

  it('C.7 CASE5: missing 1 dari 5 → 80% (persis delta 20). normalizeBarcode numeric 00999 auto prefix AST- = AST-00999. guards condition rating.', () => {
    const req = ['AST-001', 'AST-002', 'AST-003', 'AST-004', 'AST-005'];
    const done = ['AST-001', 'AST-002', 'AST-003', 'AST-004'];
    const r = patrolComplianceRate(req, done);
    expect(r.compliancePercent).toBe(80);
    expect(r.totalMissed).toBe(1);
    expect(normalizeBarcode('00999')).toBe('AST-00999');
    expect(normalizeBarcode('AST-00999')).toBe('AST-00999');
    expect(normalizeBarcode('not valid $$$')).toBe(null);
    expect(isValidConditionRating('EXCELLENT')).toBe(true);
    expect(isValidConditionRating('BAGUS' as any)).toBe(false);
    expect(conditionToNumeric('GOOD')).toBe(4);
    expect(conditionToNumeric(null)).toBe(1);
    expect(numericToCondition(5)).toBe('EXCELLENT');
    expect(numericToCondition(99)).toBe('FAIR');
  });
});
