import {
  calculateTotalMinutes,
  formatDurationHoursMinutes,
  validateOverlapHours,
  findOverlappingPairs,
  validateActivityGeoRadius,
} from './daily-activity';

describe('C.5 daily activity pure functions', () => {
  it('C.5 CASE1: calculateTotalMinutes exact 8h = 480 minutes', () => {
    const mins = calculateTotalMinutes(new Date(2026, 7, 18, 9, 0), new Date(2026, 7, 18, 17, 0));
    expect(mins).toBe(480);
    const { hours, minutes } = formatDurationHoursMinutes(mins);
    expect(hours).toBe(8);
    expect(minutes).toBe(0);
  });

  it('C.5 CASE2: two activities overlap (09:00-10:30 & 10:00-11:00 = overlap 30 menit). Overlap true + correct minutes', () => {
    const a = { activityType: 'WORK' as const, startTime: new Date(2026, 7, 18, 9, 0), endTime: new Date(2026, 7, 18, 10, 30) };
    const b = { activityType: 'MEETING' as const, startTime: new Date(2026, 7, 18, 10, 0), endTime: new Date(2026, 7, 18, 11, 0) };
    const res = validateOverlapHours(a, b);
    expect(res.overlaps).toBe(true);
    expect(res.overlapMinutes).toBe(30);
  });

  it('C.5 CASE3: GeoTag distance < 200m branch radius => within radius true; Monas offset 0.0003 derajat ≈ 33m', () => {
    const branch = { latitude: -6.1754, longitude: 106.8272, radiusMeters: 200 };
    const act = { latitude: -6.1754 + 0.0003, longitude: 106.8272 };
    const r = validateActivityGeoRadius(act, branch);
    expect(r.hasBranchGeo).toBe(true);
    expect(r.hasActivityGeo).toBe(true);
    expect(r.distanceMeters).toBeGreaterThanOrEqual(0);
    expect(r.distanceMeters).toBeLessThan(200);
    expect(r.isWithinRadius).toBe(true);
  });

  it('C.5 CASE4: Geo distance > radius (Monas -> Istora 2.5 km, radius 200m => outside false)', () => {
    const branch = { latitude: -6.1754, longitude: 106.8272, radiusMeters: 200 };
    const istora = { latitude: -6.2000, longitude: 106.8245 };
    const r = validateActivityGeoRadius(istora, branch);
    expect(r.isWithinRadius).toBe(false);
    expect(r.distanceMeters).toBeGreaterThan(2000);
  });

  it('C.5 CASE5: invalid duration (start > end = 0 mins) empty list no overlap (guards)', () => {
    expect(calculateTotalMinutes(new Date(2026, 7, 18, 17, 0), new Date(2026, 7, 18, 9, 0))).toBe(0);
    expect(
      findOverlappingPairs([
        { activityType: 'WORK' as const, startTime: 'invalid', endTime: new Date() },
        { activityType: 'OTHER' as const, startTime: new Date(), endTime: new Date() },
      ]).length,
    ).toBe(0);
    expect(formatDurationHoursMinutes(-30)).toEqual({ hours: 0, minutes: 0 });
  });

  it('C.5 CASE6: no branch geo => no geofence => auto within true; no activity lat/lon => geo present false = outside', () => {
    const noBranch = validateActivityGeoRadius({ latitude: -6.1754, longitude: 106.8272 }, { latitude: null, longitude: null });
    expect(noBranch.isWithinRadius).toBe(true);
    expect(noBranch.distanceMeters).toBe(-1);
    const noActivity = validateActivityGeoRadius({ latitude: null, longitude: null }, { latitude: -6.1754, longitude: 106.8272, radiusMeters: 200 });
    expect(noActivity.isWithinRadius).toBe(false);
    expect(noActivity.hasActivityGeo).toBe(false);
    // findOverlappingPairs 3 tasks: 1 pair overlap, 2 non-overlap. return length = 1
    const list = [
      { activityType: 'WORK' as const, startTime: new Date(2026, 7, 18, 9, 0), endTime: new Date(2026, 7, 18, 12, 0) },
      { activityType: 'SITE_VISIT' as const, startTime: new Date(2026, 7, 18, 11, 30), endTime: new Date(2026, 7, 18, 14, 30) },
      { activityType: 'MEETING' as const, startTime: new Date(2026, 7, 18, 15, 0), endTime: new Date(2026, 7, 18, 16, 30) },
    ];
    const pairs = findOverlappingPairs(list);
    expect(pairs.length).toBe(1);
    expect(pairs[0].indexA).toBe(0);
    expect(pairs[0].indexB).toBe(1);
    expect(pairs[0].overlapMinutes).toBe(30);
  });
});
