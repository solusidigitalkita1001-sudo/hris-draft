/**
 * Composing a scheduled wall-clock time into an instant.
 *
 * Extracted from `attendance.service.ts`, where it was private, so the
 * auto-checkout sweep can use the SAME convention the late-minutes
 * calculation already uses. Two definitions of "what instant is 17:00 on this
 * date" would mean the system judging lateness by one clock and work duration
 * by another, and the difference would only surface as wrong overtime.
 *
 * The composition used to run through `Date#setHours`, which means the *server
 * process* timezone. Nothing sets one in production — neither
 * docker/node-backend/Dockerfile nor docker-compose.prod.yml — so the server
 * runs UTC and an 08:00 Asia/Jakarta shift was judged as 08:00 UTC: seven hours
 * off. In that direction the error is silent rather than loud, because every
 * real WIB arrival lands *before* the skewed schedule, so lateness was simply
 * never recorded; early-leave and the night-shift auto-checkout were wrong the
 * same way.
 *
 * So the timezone is now an explicit, required argument: the employee's branch
 * timezone, else their company's. There is deliberately no overload that omits
 * it — a defaulted timezone is exactly how the server's clock got in here.
 *
 * `Intl` does the zone arithmetic. No date library is introduced for this:
 * `dateKeyInTimezone` in attendance.service already reads zones through
 * `Intl.DateTimeFormat`, and keeping one mechanism is worth more than a terser
 * call site.
 */

/** The schema default for `Company.timezone` and `Branch.timezone`. */
export const DEFAULT_ATTENDANCE_TIMEZONE = 'Asia/Jakarta';

/**
 * The timezone a schedule should be read in: where the employee actually
 * clocks in (their branch), else the company's, else the schema default.
 *
 * A blank column counts as absent. Both columns are `NOT NULL` with a default,
 * but a row written before the default — or by an import — can still carry an
 * empty string, and `''` is not a timezone.
 */
export function resolveEffectiveTimezone(
  branchTimezone?: string | null,
  companyTimezone?: string | null,
): string {
  return branchTimezone?.trim() || companyTimezone?.trim() || DEFAULT_ATTENDANCE_TIMEZONE;
}

/**
 * How far the zone's wall clock is ahead of UTC at a given instant, in ms.
 * `null` when the zone is unusable, which the callers read as "fall back to
 * UTC" — the same way `dateKeyInTimezone` degrades rather than taking
 * attendance down over one bad string.
 */
function zoneOffsetMs(instant: number, timezone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant));
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    // `hour` can come back as "24" for midnight depending on the engine.
    const wallClock = Date.UTC(
      Number(value.year),
      Number(value.month) - 1,
      Number(value.day),
      Number(value.hour) % 24,
      Number(value.minute),
      Number(value.second),
    );
    if (!Number.isFinite(wallClock)) return null;
    return wallClock - instant;
  } catch {
    return null;
  }
}

/**
 * The instant at which `HH:MM` on the given calendar date reads on the clock in
 * `timezone`.
 *
 * Two passes, because the offset depends on the instant we are still solving
 * for: guess with the offset at the naive instant, then re-read the offset at
 * the candidate and redo the subtraction if the guess straddled a DST change.
 * Indonesia has no DST, so this only matters for a company configured outside
 * it — but a schedule silently wrong twice a year is not a better bug than one
 * wrong always.
 */
function zonedWallClockToInstant(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timezone: string,
): Date {
  const naive = Date.UTC(year, month, day, hours, minutes, 0, 0);
  const firstOffset = zoneOffsetMs(naive, timezone);
  if (firstOffset === null) return new Date(naive);

  const candidate = naive - firstOffset;
  const secondOffset = zoneOffsetMs(candidate, timezone);
  if (secondOffset === null || secondOffset === firstOffset) return new Date(candidate);
  return new Date(naive - secondOffset);
}

/**
 * `HH:MM` as numbers. A component that does not parse reads as 0 rather than
 * as `NaN`: callers only reach here with a non-empty schedule string, and an
 * unparseable one used to propagate `NaN` all the way into the stored
 * `lateMinutes`/`workDuration` columns.
 */
function parseWallClock(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours: Number.isFinite(hours) ? hours : 0, minutes: Number.isFinite(minutes) ? minutes : 0 };
}

/** Minutes since midnight — used only to decide whether a shift is overnight. */
function minutesOfDay(time: string): number {
  const { hours, minutes } = parseWallClock(time);
  return hours * 60 + minutes;
}

/**
 * `HH:MM` on `baseDate`'s calendar date, read on the clock in `timezone`.
 *
 * The calendar date is taken from `baseDate`'s **UTC** components on purpose.
 * That is what both storage conventions in this codebase mean: `Attendance.date`
 * is `@db.Date` and comes back from Prisma as midnight UTC, and the
 * `calendarDate` that self-service check-in writes is noon UTC of the
 * employee's local date (attendance.service.ts). Converting the instant into
 * `timezone` first would re-derive a date that is already decided, and would
 * shift it for any zone west of UTC.
 */
export function buildScheduledTime(baseDate: Date, time: string, timezone: string): Date {
  const { hours, minutes } = parseWallClock(time);
  return zonedWallClockToInstant(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hours,
    minutes,
    timezone,
  );
}

/**
 * The shift's end. A shift whose end is at or before its start is an overnight
 * shift, so the end belongs to the following day — without this, a 22:00-06:00
 * shift would compute a negative duration.
 *
 * The comparison is on the wall-clock strings rather than on two composed
 * instants: "is 06:00 before 22:00" is a question about the schedule, and
 * asking it of instants would make the answer depend on a DST change that
 * happens to fall on that date.
 */
export function buildScheduledEndTime(
  baseDate: Date,
  workStart: string | null | undefined,
  workEnd: string | null | undefined,
  timezone: string,
): Date | null {
  if (!workEnd) return null;

  const { hours, minutes } = parseWallClock(workEnd);
  const crossesMidnight = Boolean(workStart) && minutesOfDay(workEnd) <= minutesOfDay(workStart as string);

  return zonedWallClockToInstant(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate() + (crossesMidnight ? 1 : 0),
    hours,
    minutes,
    timezone,
  );
}

export function minutesBetween(laterDate: Date, earlierDate: Date): number {
  return Math.max(0, Math.round((laterDate.getTime() - earlierDate.getTime()) / 60000));
}
