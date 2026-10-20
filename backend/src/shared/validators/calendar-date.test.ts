import { calendarDateSchema, toCalendarDate } from './calendar-date';

/**
 * Yang dijaga di sini: hari yang dimaksud klien tidak boleh bergeser, dari
 * bentuk apa pun yang dikirim. Bug yang mahal pada izin bukan error — melainkan
 * izin 2 November yang diam-diam tercatat 1 November.
 */
describe('calendar date', () => {
  const dayOf = (value: string) => toCalendarDate(value)?.toISOString().slice(0, 10);

  it('menerima tanggal date-only apa adanya', () => {
    expect(dayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('mengembalikan tengah malam UTC, konvensi yang dipakai query rentang tanggal', () => {
    expect(toCalendarDate('2026-11-02')?.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('rentang dua hari tetap mencakup dua baris kalender', () => {
    // Regresi: normalisasi ke tengah hari membuat hari pertama jatuh di luar
    // filter `gte` sehingga cuti Senin–Selasa terhitung satu hari kerja.
    const start = toCalendarDate('2026-12-28')!;
    const end = toCalendarDate('2026-12-29')!;
    const days: string[] = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      days.push(cursor.toISOString().slice(0, 10));
    }
    expect(days).toEqual(['2026-12-28', '2026-12-29']);
  });

  it('mengembalikan hari yang dimaksud dari tengah malam WIB yang dikirim web', () => {
    // dayjs('2026-11-02').toISOString() di UTC+7
    expect(dayOf('2026-11-01T17:00:00.000Z')).toBe('2026-11-02');
  });

  it('juga benar untuk zona barat dan timur', () => {
    expect(dayOf('2026-11-02T05:00:00.000Z')).toBe('2026-11-02'); // UTC-5
    expect(dayOf('2026-11-01T15:00:00.000Z')).toBe('2026-11-02'); // UTC+9
  });

  it('menolak yang bukan tanggal', () => {
    expect(toCalendarDate('kemarin')).toBeNull();
    expect(calendarDateSchema.safeParse('2026-13-45').success).toBe(false);
  });

  it('schema menghasilkan Date, bukan string', () => {
    const parsed = calendarDateSchema.parse('2026-11-02');
    expect(parsed).toBeInstanceOf(Date);
  });
});
