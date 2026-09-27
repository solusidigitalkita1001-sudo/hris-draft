/** Helper non-komponen untuk kartu dashboard (dipisah agar fast-refresh tetap bersih). */

/** Palet avatar/chart sekunder sesuai DESIGN.md (bukan warna arbitrer). */
export const AVATAR_PALETTE = ['#5D87B4', '#8FABC8', '#B3C6DA'];

export function avatarColor(index: number): string {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
}

export function initialsOf(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/[\s._@-]+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

/** Format menit kerja → "7j 55m". */
export function formatDuration(minutes?: number | null): string {
  if (minutes == null || Number.isNaN(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}m`;
  return `${h}j ${m ? `${m}m` : ''}`.trim();
}
