/**
 * Composing a scheduled wall-clock time into an instant.
 *
 * Extracted from `attendance.service.ts`, where it was private, so the
 * auto-checkout sweep can use the SAME convention the late-minutes
 * calculation already uses. Two definitions of "what instant is 17:00 on this
 * date" would mean the system judging lateness by one clock and work duration
 * by another, and the difference would only surface as wrong overtime.
 *
 * Behaviour is unchanged by the move: same local-time construction, same
 * overnight roll-forward.
 */

/** `HH:MM` on `baseDate`, in the server's local time — as before. */
export function buildScheduledTime(baseDate: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

/**
 * The shift's end. A shift whose end is at or before its start is an overnight
 * shift, so the end belongs to the following day — without this, a 22:00-06:00
 * shift would compute a negative duration.
 */
export function buildScheduledEndTime(
  baseDate: Date,
  workStart: string | null | undefined,
  workEnd: string | null | undefined,
): Date | null {
  if (!workEnd) return null;

  const scheduledEnd = buildScheduledTime(baseDate, workEnd);
  if (workStart) {
    const scheduledStart = buildScheduledTime(baseDate, workStart);
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd.setDate(scheduledEnd.getDate() + 1);
    }
  }

  return scheduledEnd;
}

export function minutesBetween(laterDate: Date, earlierDate: Date): number {
  return Math.max(0, Math.round((laterDate.getTime() - earlierDate.getTime()) / 60000));
}
