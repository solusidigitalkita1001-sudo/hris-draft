/**
 * Generating a calendar year used to build it from the weekly working pattern
 * alone, and started by deleting the rows already there. The result was a year
 * in which every public holiday was an ordinary working day, and the holidays
 * previously recorded were gone. Attendance, leave and payroll all read this
 * table to decide whether a day is worked, so the damage was not cosmetic.
 */

const prismaMock = {
  workCalendar: { findUnique: jest.fn() },
  nationalHoliday: { findMany: jest.fn() },
  workCalendarDay: { deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
};

// The repository imports the named export, so providing only `default` leaves
// `prisma` undefined and every case fails on the first property access.
jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { workCalendarRepository } from './work-calendar.repository';

type Day = { date: Date; dayType: string; name?: string | null; workStart?: string | null };

const MON_TO_FRI = {
  monday: { enabled: true, workStart: '08:00', workEnd: '17:00' },
  tuesday: { enabled: true, workStart: '08:00', workEnd: '17:00' },
  wednesday: { enabled: true, workStart: '08:00', workEnd: '17:00' },
  thursday: { enabled: true, workStart: '08:00', workEnd: '17:00' },
  friday: { enabled: true, workStart: '08:00', workEnd: '17:00' },
  saturday: { enabled: false, workStart: null, workEnd: null },
  sunday: { enabled: false, workStart: null, workEnd: null },
};

function key(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('generating a calendar year', () => {
  let written: Day[] = [];

  beforeEach(async () => {
    jest.clearAllMocks();
    written = [];
    prismaMock.workCalendar.findUnique.mockResolvedValue({ companyId: 'company-1' });
    prismaMock.nationalHoliday.findMany.mockResolvedValue([
      // A Tuesday, so the weekly pattern alone would call it a working day.
      { date: new Date(2026, 7, 17), name: 'Proklamasi Kemerdekaan RI', type: 'NH' },
      { date: new Date(2026, 11, 25), name: 'Hari Raya Natal', type: 'NH' },
      { date: new Date(2026, 2, 23), name: 'Cuti Bersama Idulfitri', type: 'JL' },
    ]);
    prismaMock.workCalendarDay.createMany.mockImplementation(({ data }: { data: Day[] }) => {
      written = data;
      return Promise.resolve({ count: data.length });
    });
    prismaMock.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(prismaMock));

    await workCalendarRepository.generateDefaultDays('calendar-1', 2026, MON_TO_FRI);
  });

  it('covers every day of the year exactly once', () => {
    expect(written).toHaveLength(365);
    expect(new Set(written.map((day) => key(day.date))).size).toBe(365);
  });

  it('marks a public holiday that falls on a working weekday as a holiday', () => {
    const independenceDay = written.find((day) => key(day.date) === '2026-08-17');
    expect(independenceDay?.dayType).toBe('NH');
    expect(independenceDay?.name).toBe('Proklamasi Kemerdekaan RI');
    // A non-working day must not carry working hours, or the shift resolver
    // will happily schedule someone on it.
    expect(independenceDay?.workStart).toBeNull();
  });

  it('keeps a joint leave day distinct from a public holiday', () => {
    expect(written.find((day) => key(day.date) === '2026-03-23')?.dayType).toBe('JL');
  });

  it('still applies the weekly pattern everywhere else', () => {
    expect(written.find((day) => key(day.date) === '2026-08-18')?.dayType).toBe('WD');
    expect(written.find((day) => key(day.date) === '2026-08-16')?.dayType).toBe('WE');
  });

  it('only reads the holidays of the company that owns the calendar', () => {
    expect(prismaMock.nationalHoliday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', year: 2026 } }),
    );
  });

  it('replaces the year inside a transaction, so a failure cannot empty the calendar', () => {
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.workCalendarDay.deleteMany).toHaveBeenCalledWith({ where: { calendarId: 'calendar-1' } });
  });

  it('does nothing when the calendar does not exist', async () => {
    jest.clearAllMocks();
    prismaMock.workCalendar.findUnique.mockResolvedValue(null);
    await expect(workCalendarRepository.generateDefaultDays('missing', 2026, MON_TO_FRI)).resolves.toEqual({ count: 0 });
    expect(prismaMock.workCalendarDay.deleteMany).not.toHaveBeenCalled();
  });
});
