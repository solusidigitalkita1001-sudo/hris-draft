/**
 * Sliding idle window untuk sesi (SEC): karena refresh token DIROTASI pada
 * setiap refresh, `createdAt` token yang tersimpan == waktu aktivitas
 * terautentikasi terakhir. Bila jarak ke `now` melewati batas idle, sesi
 * dianggap ditinggalkan dan refresh harus ditolak (family dicabut).
 *
 * Catatan kalibrasi: batas ini HARUS lebih besar dari umur access token
 * (15 menit) — klien baru me-refresh setelah access token kedaluwarsa,
 * sehingga usia refresh token pengguna aktif normalnya ±15 menit.
 */
export function isRefreshTokenIdleExpired(
  lastIssuedAt: Date,
  now: Date,
  idleTimeoutMinutes: number,
): boolean {
  if (!Number.isFinite(idleTimeoutMinutes) || idleTimeoutMinutes <= 0) return false;
  return now.getTime() - lastIssuedAt.getTime() > idleTimeoutMinutes * 60_000;
}
