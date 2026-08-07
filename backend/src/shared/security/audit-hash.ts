/**
 * Integritas audit log — anti-tamper (hardening Business Rule Gap modul Audit Log).
 *
 * Tiap entry audit di-hash dengan HMAC-SHA256 memakai kunci server (config.encryption.key)
 * atas konten kanonik + hash entry sebelumnya (prevHash) → membentuk hash-chain.
 * Karena kunci HMAC hanya diketahui server, penyerang yang mengubah baris audit di DB
 * tidak dapat menghitung ulang hash yang valid → perubahan terdeteksi saat verifikasi.
 *
 * Fungsi PURE (tanpa DB).
 */
import crypto from 'crypto';
import config from '@/config';

/** Field konten yang ikut di-hash (urutan tetap = kanonik). */
export interface AuditHashPayload {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: Date | string;
}

/** Serialisasi kanonik yang deterministik (urutan field tetap). */
export function canonicalizeAuditPayload(p: AuditHashPayload): string {
  const createdAt = p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString();
  return [
    p.companyId ?? '',
    p.userId ?? '',
    p.action,
    p.entity,
    p.entityId ?? '',
    p.oldValue ?? '',
    p.newValue ?? '',
    createdAt,
  ].join('|');
}

/**
 * Hitung hash HMAC-SHA256 sebuah entry audit, dirantai dengan prevHash.
 * @param prevHash hash entry sebelumnya ('' untuk entry pertama / genesis).
 */
export function computeAuditHash(payload: AuditHashPayload, prevHash: string = ''): string {
  const canonical = `${canonicalizeAuditPayload(payload)}|${prevHash}`;
  return crypto.createHmac('sha256', config.encryption.key).update(canonical).digest('hex');
}

/** Verifikasi 1 entry: cocokkan hash tersimpan dengan hasil hitung ulang (timing-safe). */
export function verifyAuditHash(payload: AuditHashPayload, prevHash: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const expected = computeAuditHash(payload, prevHash);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verifikasi integritas rantai untuk daftar entry terurut (createdAt asc).
 * Mengembalikan indeks & id entry pertama yang gagal (tampered), atau null jika utuh.
 */
export function verifyAuditChain(
  entries: Array<AuditHashPayload & { id: string; hash: string | null; prevHash: string | null }>
): { ok: boolean; tamperedAt: { index: number; id: string } | null } {
  let prev = '';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!verifyAuditHash(e, prev, e.hash)) {
      return { ok: false, tamperedAt: { index: i, id: e.id } };
    }
    prev = e.hash ?? '';
  }
  return { ok: true, tamperedAt: null };
}
