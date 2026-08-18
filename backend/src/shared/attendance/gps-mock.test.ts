import {
  haversineMeters,
  checkRadius,
  assessMockLocation,
  assessGpsCompliance,
  MockLocationVerdict,
  R_EARTH_METERS,
} from './gps-mock';

const MONAS: { latitude: number; longitude: number } = { latitude: -6.1754, longitude: 106.8272 };
const ISTORA_MONAS: { latitude: number; longitude: number } = { latitude: -6.2000, longitude: 106.8245 };

describe('gps mock & haversine B.9', () => {
  it('B.9 CASE1: haversine Monas -> dekat Monas (<180m) -> value akurat (>=0, <=500m)', () => {
    const closeBy = { latitude: -6.1754 + 0.0005, longitude: 106.8272 + 0.0005 };
    const d = haversineMeters(MONAS, closeBy);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(100);
    expect(Number.isFinite(d)).toBe(true);
  });

  it('B.9 CASE2: haversine Monas -> Istora Senayan distance sekitar 2.5-3km', () => {
    const d = haversineMeters(MONAS, ISTORA_MONAS);
    expect(d).toBeGreaterThan(2_000);
    expect(d).toBeLessThan(4_000);
  });

  it('B.9 CASE3: radius check within 200m isWithinRadius true; 2000m false', () => {
    const near = { latitude: MONAS.latitude + 0.0003, longitude: MONAS.longitude };
    const branch = { latitude: MONAS.latitude, longitude: MONAS.longitude, radiusMeters: 200, name: 'Kantor Monas' };
    expect(checkRadius(near, branch).isWithinRadius).toBe(true);
    expect(checkRadius(ISTORA_MONAS, branch).isWithinRadius).toBe(false);
    expect(checkRadius(ISTORA_MONAS, branch).distanceMeters).toBeGreaterThan(2000);
  });

  it('B.9 CASE4: isMockLocation=true -> CONFIRMED_FAKE. Fake GPS app -> CONFIRMED_FAKE', () => {
    expect(assessMockLocation({ isMockLocation: true })).toBe(MockLocationVerdict.CONFIRMED_FAKE);
    expect(assessMockLocation({ mockProviderApp: 'com.lexa.fakegps' })).toBe(MockLocationVerdict.CONFIRMED_FAKE);
  });

  it('B.9 CASE5: accuracy 300m JELEK + coord stagnan 30 jam -> SUSPICIOUS. Accuracy bagus 20m -> PASS', () => {
    expect(assessMockLocation({ accuracyMeters: 300, coordinateStaleHours: 30 })).toBe(MockLocationVerdict.SUSPICIOUS);
    expect(assessMockLocation({ accuracyMeters: 20 })).toBe(MockLocationVerdict.PASS);
  });

  it('B.9 CASE6: branch null / coordinate undefined -> no crash; isWithinRadius true fallback (tidak ada geofence)', () => {
    const nullBranch = checkRadius({ latitude: -6.175, longitude: 106.82 }, null);
    expect(nullBranch.isWithinRadius).toBe(true);
    expect(nullBranch.distanceMeters).toBe(-1);

    const noCoord = checkRadius(null, { latitude: MONAS.latitude, longitude: MONAS.longitude, radiusMeters: 200 });
    expect(noCoord.isWithinRadius).toBe(false);

    const full = assessGpsCompliance(ISTORA_MONAS, { latitude: MONAS.latitude, longitude: MONAS.longitude, radiusMeters: 200 }, { isMockLocation: true });
    expect(full.mockVerdict).toBe(MockLocationVerdict.CONFIRMED_FAKE);
    expect(full.warnings.length).toBeGreaterThanOrEqual(1);
    expect(R_EARTH_METERS).toBeGreaterThan(6_370_000);
  });
});
