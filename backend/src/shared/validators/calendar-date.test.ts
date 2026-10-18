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

  it('mengembalikan tengah hari UTC supaya rendering zona waktu tidak menggeser hari', () => {
    expect(toCalendarDate('2026-11-02')?.toISOString()).toBe('2026-11-02T12:00:00.000Z');
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
