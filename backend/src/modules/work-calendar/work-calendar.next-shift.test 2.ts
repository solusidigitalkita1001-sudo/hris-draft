import { workCalendarRepository } from './work-calendar.repository';
import { selectNextScheduledShift, workCalendarService } from './work-calendar.service';
import type { ResolvedWorkCalendarMonthDay } from './work-calendar.repository';

function day(date: string, overrides: Partial<ResolvedWorkCalendarMonthDay> = {}): ResolvedWorkCalendarMonthDay {
  return {
    date,
    calendarId: 'calendar-1',
    dayType: 'WD',
    workStart: '08:00',
    workEnd: '17:00',
    isWorkingDay: true,
    scheduleSource: 'CALENDAR',
    label: null,
    notes: null,
    absence: null,
    ...overrides,
  };
}

describe('next shift resolution', () => {
  afterEach(() => jest.restoreAllMocks());

  it('skips off-days and approved absences within an inclusive range', () => {
    const result = selectNextScheduledShift([
      day('2026-09-21', { isWorkingDay: false }),
      day('2026-09-22', { absence: {
        source: 'LEAVE_REQUEST', category: 'CUTI', requestId: 'leave-1', label: 'Cuti', reason: 'Leave',
        startDate: '2026-09-22', endDate: '2026-09-22', partialDay: false,
      } }),
      day('2026-09-23'),
    ], '2026-09-21', '2026-12-22');

    expect(result?.date).toBe('2026-09-23');
  });

  it('keeps a partial-day permission as a scheduled shift', () => {
    const result = selectNextScheduledShift([
      day('2026-09-21', { absence: {
        source: 'PERMISSION_REQUEST', category: 'IZIN', requestId: 'permission-1', label: 'Izin parsial', reason: 'Appointment',
        startDate: '2026-09-21', endDate: '2026-09-21', partialDay: true,
      } }),
      day('2026-09-22'),
    ], '2026-09-21', '2026-12-22');

    expect(result?.date).toBe('2026-09-21');
  });

  it('continues into the next month and uses the office date by default', async () => {
    jest.spyOn(workCalendarRepository, 'findMyOfficeClock').mockResolvedValue({
      timezone: 'Asia/Jakarta', serverDate: '2026-09-30',
    });
    const resolve = jest.spyOn(workCalendarRepository, 'findResolvedMyWorkCalendarMonth')
      .mockResolvedValueOnce({ days: [day('2026-09-30', { isWorkingDay: false })] } as never)
      .mockResolvedValueOnce({
        employee: { id: 'employee-1' },
        days: [day('2026-10-01', { isWorkingDay: false }), day('2026-10-02')],
      } as never);

    const result = await workCalendarService.getMyNextShift('user-1');

    expect(result.shift?.date).toBe('2026-10-02');
    expect(result.timezone).toBe('Asia/Jakarta');
    expect(resolve).toHaveBeenNthCalledWith(1, 'user-1', 2026, 9);
    expect(resolve).toHaveBeenNthCalledWith(2, 'user-1', 2026, 10);
  });

  it('keeps employee context when no shift exists in the search horizon', async () => {
    jest.spyOn(workCalendarRepository, 'findMyOfficeClock').mockResolvedValue({
      timezone: 'Asia/Jakarta', serverDate: '2026-09-30',
    });
    jest.spyOn(workCalendarRepository, 'findResolvedMyWorkCalendarMonth').mockResolvedValue({
      employee: { id: 'employee-1' },
      days: [],
    } as never);

    const result = await workCalendarService.getMyNextShift('user-1');

    expect(result.shift).toBeNull();
    expect(result.employee).toEqual({ id: 'employee-1' });
  });
});
