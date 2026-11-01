import {
  DEFAULT_ATTENDANCE_TIMEZONE,
  buildScheduledEndTime,
  buildScheduledTime,
  minutesBetween,
  resolveEffectiveTimezone,
} from './scheduled-time';

/**
 * A schedule is written as a wall-clock string (`08:00`) and judged against an
 * instant (the check-in). Turning one into the other needs a timezone, and the
 * only timezone the old code had was the server's — which in production is UTC,
 * because neither the Dockerfile nor docker-compose.prod.yml sets one. An
 * 08:00 Asia/Jakarta shift was therefore judged as 08:00 UTC: everybody in the
 * country arrived seven hours "late".
 *
 * These tests run under `TZ=UTC` on purpose. That is production. A test that
 * only passes on a machine set to Asia/Jakarta proves nothing about the box
 * that pays people.
 */

// A Date-only column (`Attendance.date` is `@db.Date`) and the noon-UTC
// `calendarDate` convention both carry the intended calendar date in their UTC
// components, so that is where the calendar date is read from.
const DAY = new Date('2026-10-04T00:00:00.000Z');
const DAY_AT_NOON = new Date('2026-10-04T12:00:00.000Z');

describe('buildScheduledTime', () => {
  it('reads 08:00 Asia/Jakarta as 01:00 UTC, not 08:00 UTC', () => {
    expect(buildScheduledTime(DAY, '08:00', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-04T01:00:00.000Z');
  });

  it('follows WITA (Asia/Makassar, UTC+8) for a branch in the central zone', () => {
    expect(buildScheduledTime(DAY, '08:00', 'Asia/Makassar').toISOString())
      .toBe('2026-10-04T00:00:00.000Z');
  });

  it('follows WIT (Asia/Jayapura, UTC+9)', () => {
    expect(buildScheduledTime(DAY, '08:00', 'Asia/Jayapura').toISOString())
      .toBe('2026-10-03T23:00:00.000Z');
  });

  it('takes the calendar date from the UTC components, so noon-UTC and date-only rows agree', () => {
    expect(buildScheduledTime(DAY_AT_NOON, '08:00', 'Asia/Jakarta').toISOString())
      .toBe(buildScheduledTime(DAY, '08:00', 'Asia/Jakarta').toISOString());
  });

  it('keeps midnight on the stated calendar date rather than rolling a day', () => {
    expect(buildScheduledTime(DAY, '00:00', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-03T17:00:00.000Z');
  });

  it('resolves a DST offset from the scheduled day, not from a fixed guess', () => {
    // 2026-03-08 is the US spring-forward date: 08:00 is EDT (UTC-4) that day
    // and EST (UTC-5) the day before. A fixed offset would be wrong on one.
    expect(buildScheduledTime(new Date('2026-03-07T00:00:00.000Z'), '08:00', 'America/New_York').toISOString())
      .toBe('2026-03-07T13:00:00.000Z');
    expect(buildScheduledTime(new Date('2026-03-08T00:00:00.000Z'), '08:00', 'America/New_York').toISOString())
      .toBe('2026-03-08T12:00:00.000Z');
  });

  it('still lands on the stated calendar date for a wall-clock time DST skipped', () => {
    // 02:30 never happens on 2026-03-08 in New York. Any answer is a
    // compromise; an answer on a different calendar date is a bug.
    const scheduled = buildScheduledTime(new Date('2026-03-08T00:00:00.000Z'), '02:30', 'America/New_York');
    expect(Number.isFinite(scheduled.getTime())).toBe(true);
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(scheduled))
      .toBe('2026-03-08');
  });

  it('reads an unparseable component as zero instead of letting NaN reach the column', () => {
    // `lateMinutes` and `workDuration` are written from these instants, and a
    // NaN there is a corrupt row rather than a visible error.
    expect(buildScheduledTime(DAY, 'pagi', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-03T17:00:00.000Z');
    expect(buildScheduledTime(DAY, '08', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-04T01:00:00.000Z');
  });

  it('falls back to UTC when the stored timezone is not a real zone', () => {
    // Mirrors `dateKeyInTimezone`: an unusable zone must not take attendance
    // down, and UTC is the one offset that is always available.
    expect(buildScheduledTime(DAY, '08:00', 'Mars/Olympus_Mons').toISOString())
      .toBe('2026-10-04T08:00:00.000Z');
  });
});

describe('lateness measured across the timezone boundary', () => {
  it('counts 08:10 WIB against an 08:00 WIB schedule as ten minutes', () => {
    const scheduledStart = buildScheduledTime(DAY, '08:00', 'Asia/Jakarta');
    const checkIn = new Date('2026-10-04T01:10:00.000Z'); // 08:10 WIB

    expect(checkIn > scheduledStart).toBe(true);
    expect(minutesBetween(checkIn, scheduledStart)).toBe(10);
  });

  it('does not call an on-time WIB arrival seven hours late', () => {
    const scheduledStart = buildScheduledTime(DAY, '08:00', 'Asia/Jakarta');
    const checkIn = new Date('2026-10-04T00:55:00.000Z'); // 07:55 WIB

    expect(checkIn > scheduledStart).toBe(false);
    expect(minutesBetween(checkIn, scheduledStart)).toBe(0);
  });
});

describe('buildScheduledEndTime', () => {
  /** The cases below all supply a `workEnd`, so a null answer is a failure. */
  const endAt = (baseDate: Date, workStart: string | null, workEnd: string, timezone: string): Date => {
    const scheduledEnd = buildScheduledEndTime(baseDate, workStart, workEnd, timezone);
    if (!scheduledEnd) throw new Error(`no scheduled end composed for ${workEnd} ${timezone}`);
    return scheduledEnd;
  };

  it('composes a day shift end in the employee timezone', () => {
    expect(endAt(DAY, '08:00', '17:00', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-04T10:00:00.000Z');
  });

  it('rolls an overnight shift to 06:00 the next calendar day in that timezone', () => {
    expect(endAt(DAY, '22:00', '06:00', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-04T23:00:00.000Z');
  });

  it('gives an overnight WIB shift its full eight hours', () => {
    const start = buildScheduledTime(DAY, '22:00', 'Asia/Jakarta');

    expect(minutesBetween(endAt(DAY, '22:00', '06:00', 'Asia/Jakarta'), start)).toBe(8 * 60);
  });

  it('treats an end equal to the start as a full day around the clock', () => {
    expect(endAt(DAY, '08:00', '08:00', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-05T01:00:00.000Z');
  });

  it('keeps the real elapsed hours when an overnight shift crosses a DST change', () => {
    // 22:00 EST on 2026-03-07 to 06:00 EDT on 2026-03-08 is seven hours, not
    // eight: the clock jumped forward while the shift was running.
    const base = new Date('2026-03-07T00:00:00.000Z');
    const start = buildScheduledTime(base, '22:00', 'America/New_York');
    const end = endAt(base, '22:00', '06:00', 'America/New_York');

    expect(start.toISOString()).toBe('2026-03-08T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-08T10:00:00.000Z');
    expect(minutesBetween(end, start)).toBe(7 * 60);
  });

  it('has no end to compose when the schedule carries none', () => {
    expect(buildScheduledEndTime(DAY, '08:00', null, 'Asia/Jakarta')).toBeNull();
    expect(buildScheduledEndTime(DAY, '08:00', undefined, 'Asia/Jakarta')).toBeNull();
  });

  it('does not roll forward when the shift has no recorded start', () => {
    expect(endAt(DAY, null, '17:00', 'Asia/Jakarta').toISOString())
      .toBe('2026-10-04T10:00:00.000Z');
  });
});

describe('resolveEffectiveTimezone', () => {
  it('prefers the branch, because that is where the employee actually clocks in', () => {
    expect(resolveEffectiveTimezone('Asia/Makassar', 'Asia/Jakarta')).toBe('Asia/Makassar');
  });

  it('falls back to the company when the employee has no branch', () => {
    expect(resolveEffectiveTimezone(null, 'Asia/Jayapura')).toBe('Asia/Jayapura');
  });

  it('falls back to Asia/Jakarta, the schema default, when neither is stored', () => {
    expect(resolveEffectiveTimezone(null, null)).toBe(DEFAULT_ATTENDANCE_TIMEZONE);
    expect(DEFAULT_ATTENDANCE_TIMEZONE).toBe('Asia/Jakarta');
  });

  it('treats a blank column as absent rather than as a timezone', () => {
    expect(resolveEffectiveTimezone('', '  ')).toBe(DEFAULT_ATTENDANCE_TIMEZONE);
    expect(resolveEffectiveTimezone('   ', 'Asia/Makassar')).toBe('Asia/Makassar');
  });
});

describe('minutesBetween', () => {
  it('never reports negative time', () => {
    expect(minutesBetween(new Date('2026-10-04T01:00:00Z'), new Date('2026-10-04T02:00:00Z'))).toBe(0);
  });
});
