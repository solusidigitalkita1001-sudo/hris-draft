import { haversineMeters, isValidLatitude, isValidLongitude } from '../attendance/gps-mock';

export type DailyActivityType = 'WORK' | 'SITE_VISIT' | 'SITE_INSPECTION' | 'MEETING' | 'OTHER';

export interface DailyActivityRow {
  id?: string | null;
  employeeId?: string | null;
  activityType: DailyActivityType;
  startTime: Date | string | number;
  endTime: Date | string | number;
  durationMinutes?: number | null;
  latitude?: number | string | Decimal | null;
  longitude?: number | string | Decimal | null;
}

type Decimal = { toNumber(): number } | number;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object' && v !== null && typeof (v as any).toNumber === 'function') {
    const n = (v as any).toNumber();
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function calculateTotalMinutes(start: unknown, end: unknown): number {
  const sd = toDate(start);
  const ed = toDate(end);
  if (!sd || !ed) return 0;
  const ms = ed.getTime() - sd.getTime();
  if (ms < 0) return 0;
  return Math.round(ms / 60_000);
}

export function formatDurationHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.trunc(Number(totalMinutes) || 0));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export interface OverlapResult {
  overlaps: boolean;
  overlapMinutes: number;
}

export function validateOverlapHours(a: DailyActivityRow, b: DailyActivityRow): OverlapResult {
  const a0 = toDate(a.startTime);
  const a1 = toDate(a.endTime);
  const b0 = toDate(b.startTime);
  const b1 = toDate(b.endTime);
  if (!a0 || !a1 || !b0 || !b1 || a1.getTime() <= a0.getTime() || b1.getTime() <= b0.getTime()) {
    return { overlaps: false, overlapMinutes: 0 };
  }
  const overlapStart = new Date(Math.max(a0.getTime(), b0.getTime()));
  const overlapEnd = new Date(Math.min(a1.getTime(), b1.getTime()));
  if (overlapEnd.getTime() <= overlapStart.getTime()) return { overlaps: false, overlapMinutes: 0 };
  const mins = Math.max(1, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60_000));
  return { overlaps: true, overlapMinutes: mins };
}

export function findOverlappingPairs(list: DailyActivityRow[]): Array<{ indexA: number; indexB: number; overlapMinutes: number }> {
  const out: Array<{ indexA: number; indexB: number; overlapMinutes: number }> = [];
  const len = list.length;
  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      const ov = validateOverlapHours(list[i], list[j]);
      if (ov.overlaps) out.push({ indexA: i, indexB: j, overlapMinutes: ov.overlapMinutes });
    }
  }
  return out;
}

export interface ActivityGeoCheckResult {
  hasBranchGeo: boolean;
  hasActivityGeo: boolean;
  distanceMeters: number;
  radiusMeters: number;
  isWithinRadius: boolean;
}

export function validateActivityGeoRadius(
  activity: Pick<DailyActivityRow, 'latitude' | 'longitude'>,
  branch: { latitude?: number | null; longitude?: number | null; radiusMeters?: number | null },
  fallbackRadiusMeters = 200,
): ActivityGeoCheckResult {
  const actLat = toNum(activity.latitude);
  const actLon = toNum(activity.longitude);
  const brLat = toNum(branch.latitude);
  const brLon = toNum(branch.longitude);
  const hasBranchGeo = isValidLatitude(brLat) && isValidLongitude(brLon);
  const hasActivityGeo = isValidLatitude(actLat) && isValidLongitude(actLon);
  const radius = Number(branch.radiusMeters);
  const radiusMeters = Number.isFinite(radius) && radius > 0 ? radius : fallbackRadiusMeters;

  if (!hasBranchGeo) {
    return { hasBranchGeo: false, hasActivityGeo, distanceMeters: -1, radiusMeters, isWithinRadius: true };
  }
  if (!hasActivityGeo) {
    return { hasBranchGeo: true, hasActivityGeo: false, distanceMeters: -1, radiusMeters, isWithinRadius: false };
  }
  const d = Math.round(
    haversineMeters(
      { latitude: actLat as number, longitude: actLon as number },
      { latitude: brLat as number, longitude: brLon as number },
    ),
  );
  return { hasBranchGeo: true, hasActivityGeo: true, distanceMeters: d, radiusMeters, isWithinRadius: d <= radiusMeters };
}
