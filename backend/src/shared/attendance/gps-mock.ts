export enum MockLocationVerdict {
  PASS = 'PASS',
  LIKELY_REAL = 'LIKELY_REAL',
  SUSPICIOUS = 'SUSPICIOUS',
  CONFIRMED_FAKE = 'CONFIRMED_FAKE',
}

export const R_EARTH_METERS = 6_371_008.8;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface DeviceGpsEvidence {
  /// Android flag ALLOW_MOCK_LOCATION, atau iOS simulator = true
  isMockLocation?: boolean | null;
  /// Android "MockProvider GPS" terdeteksi (Fake GPS app, iMyFone, dll)
  mockProviderApp?: string | null;
  /// Accuracy dalam meters. Accuracy > 150m = SUSPICIOUS
  accuracyMeters?: number | null;
  /// Koordinat persis sama dengan lokasi 24 jam lalu? flag static.
  coordinateStaleHours?: number | null;
  altitudeMeters?: number | null;
  bearingDegrees?: number | null;
  extraFlags?: Record<string, number | boolean | string | null>;
}

export interface GpsRadiusResult {
  distanceMeters: number;
  radiusMeters: number;
  isWithinRadius: boolean;
  branch: { latitude: number | null; longitude: number | null; name?: string | null } | null;
}

export interface GpsComplianceResult {
  distance: GpsRadiusResult | null;
  mockVerdict: MockLocationVerdict;
  warnings: string[];
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const la1 = toRad(Number(a.latitude));
  const la2 = toRad(Number(b.latitude));
  const dLat = toRad(Number(b.latitude) - Number(a.latitude));
  const dLon = toRad(Number(b.longitude) - Number(a.longitude));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  const clean = isFinite(h) ? Math.min(1, Math.max(0, h)) : 0;
  const c = 2 * Math.asin(Math.sqrt(clean));
  return R_EARTH_METERS * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isValidLatitude(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isValidLongitude(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
}

export function checkRadius(
  checkIn: Partial<GeoPoint> | null,
  branch: { latitude: number | null; longitude: number | null; radiusMeters?: number | null; name?: string | null } | null,
  fallbackRadiusMeters = 200,
): GpsRadiusResult {
  const radius = Number(branch?.radiusMeters);
  const effectiveRadius = Number.isFinite(radius) && radius > 0 ? radius : fallbackRadiusMeters;

  if (!branch || !isValidLatitude(branch.latitude) || !isValidLongitude(branch.longitude)) {
    return {
      distanceMeters: -1,
      radiusMeters: effectiveRadius,
      isWithinRadius: true,
      branch: branch ?? null,
    };
  }
  if (!checkIn || !isValidLatitude(checkIn.latitude) || !isValidLongitude(checkIn.longitude)) {
    return {
      distanceMeters: -1,
      radiusMeters: effectiveRadius,
      isWithinRadius: false,
      branch,
    };
  }
  const distance = haversineMeters(
    { latitude: checkIn.latitude as number, longitude: checkIn.longitude as number },
    { latitude: branch.latitude as number, longitude: branch.longitude as number },
  );
  return {
    distanceMeters: Math.round(distance),
    radiusMeters: effectiveRadius,
    isWithinRadius: distance <= effectiveRadius,
    branch,
  };
}

export function assessMockLocation(ev: DeviceGpsEvidence | null | undefined): MockLocationVerdict {
  if (!ev) return MockLocationVerdict.LIKELY_REAL;

  if (ev.isMockLocation === true) return MockLocationVerdict.CONFIRMED_FAKE;

  if (typeof ev.mockProviderApp === 'string' && ev.mockProviderApp.trim().length > 0) {
    return MockLocationVerdict.CONFIRMED_FAKE;
  }

  const warnings: string[] = [];
  if (typeof ev.accuracyMeters === 'number' && ev.accuracyMeters > 150) {
    warnings.push(`accuracy ${ev.accuracyMeters}m > 150m`);
  }
  if (typeof ev.coordinateStaleHours === 'number' && ev.coordinateStaleHours >= 24) {
    warnings.push(`koordinat stagnan ${ev.coordinateStaleHours} jam`);
  }
  if (warnings.length >= 2) return MockLocationVerdict.SUSPICIOUS;
  if (warnings.length === 1) return MockLocationVerdict.SUSPICIOUS;
  return MockLocationVerdict.PASS;
}

export function assessGpsCompliance(
  checkIn: Partial<GeoPoint> | null,
  branch: { latitude: number | null; longitude: number | null; radiusMeters?: number | null; name?: string | null } | null,
  deviceEvidence: DeviceGpsEvidence | null,
  fallbackRadiusMeters = 200,
): GpsComplianceResult {
  const distance = checkRadius(checkIn, branch, fallbackRadiusMeters);
  const mockVerdict = assessMockLocation(deviceEvidence);
  const warnings: string[] = [];
  if (distance.distanceMeters > 0 && !distance.isWithinRadius) {
    warnings.push(`jarak ${distance.distanceMeters}m melebihi radius ${distance.radiusMeters}m`);
  }
  if (mockVerdict === MockLocationVerdict.CONFIRMED_FAKE) warnings.push('mock location confirmed');
  if (mockVerdict === MockLocationVerdict.SUSPICIOUS) warnings.push('mock location suspicious');
  if (distance.distanceMeters < 0 && !!checkIn && !!branch && (branch.latitude || branch.longitude)) {
    warnings.push('koordinat check-in tidak valid');
  }
  return { distance, mockVerdict, warnings };
}
