import { z } from 'zod';

/**
 * Tanggal kalender: izin, tukar shift, dan sejenisnya terjadi pada *hari*
 * tertentu, bukan pada titik waktu. Kontrak resmi untuk klien adalah
 * `YYYY-MM-DD`.
 *
 * Klien web yang sudah berjalan mengirim hasil `dayjs(<input type="date">)
 * .toISOString()`, yaitu tengah malam lokal yang sudah dikonversi ke UTC —
 * di WIB itu mundur ke pukul 17:00 hari sebelumnya. Menolaknya akan merusak
 * aplikasi yang sudah dipakai, jadi instant tetap diterima dan dinormalkan.
 */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/**
 * Tengah malam UTC — konvensi yang sudah dipakai seluruh basis kode ini
 * (`new Date('2026-12-28')`), dan yang diasumsikan oleh query rentang tanggal
 * seperti penghitungan hari kerja. Menggesernya ke tengah hari membuat baris
 * kalender hari pertama jatuh di luar filter `gte` dan cuti dua hari terhitung
 * satu. Untuk zona Indonesia (UTC+7..+9) tengah malam UTC tetap dirender
 * sebagai tanggal yang sama.
 */
function atUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export function toCalendarDate(value: string): Date | null {
  if (CALENDAR_DATE.test(value)) {
    const date = atUtcMidnight(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  // ponytail: bulatkan ke hari UTC terdekat, bukan mencari zona waktu company.
  // Tengah malam lokal di zona mana pun jatuh dalam ±14 jam dari tengah malam
  // UTC, jadi pembulatan ini selalu mengembalikan hari yang dimaksud klien.
  // Batasnya: instant yang memang di tengah hari (mis. 20:00Z) akan dibaca
  // sebagai hari berikutnya — kalau suatu saat ada klien yang mengirim waktu
  // sungguhan, barulah zona waktu company perlu ikut dibaca.
  return atUtcMidnight(new Date(parsed.getTime() + HALF_DAY_MS).toISOString().slice(0, 10));
}

/** Zod schema: menerima `YYYY-MM-DD` atau ISO instant, menghasilkan `Date`. */
export const calendarDateSchema = z.string().transform((value, ctx) => {
  const date = toCalendarDate(value);
  if (!date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tanggal harus YYYY-MM-DD' });
    return z.NEVER;
  }
  return date;
});
