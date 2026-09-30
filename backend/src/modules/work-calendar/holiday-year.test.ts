/**
 * A national holiday carries both a date and a year column, and calendar
 * generation selects by the year. When the two disagreed the holiday existed in
 * the register, the calendar showed an ordinary working day, and neither place
 * explained why. The year is therefore derived from the date and never taken
 * from the caller.
 */

const prismaMock = {
  nationalHoliday: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { workCalendarRepository } from './work-calendar.repository';

const created = () => prismaMock.nationalHoliday.create.mock.calls[0][0].data;
const updated = () => prismaMock.nationalHoliday.update.mock.calls[0][0].data;

describe('a holiday year always matches its date', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.nationalHoliday.create.mockResolvedValue({ id: 'holiday-1' });
    prismaMock.nationalHoliday.update.mockResolvedValue({ id: 'holiday-1' });
  });

  it('derives the year from the date on create', async () => {
    await workCalendarRepository.createHoliday({
      companyId: 'company-1', date: '2026-08-17', name: 'Proklamasi Kemerdekaan RI', type: 'NH',
    });
    expect(created().year).toBe(2026);
  });

  it('ignores a year the caller supplies that contradicts the date', async () => {
    await workCalendarRepository.createHoliday({
      companyId: 'company-1', date: '2026-08-17', name: 'Proklamasi Kemerdekaan RI', type: 'NH',
      year: 2027,
    } as Parameters<typeof workCalendarRepository.createHoliday>[0]);
    expect(created().year).toBe(2026);
  });

  /**
   * 'YYYY-MM-DD' parses to UTC midnight, so reading the year in local time
   * answers with the previous year on any host west of UTC. The column is a
   * DATE; it must not depend on where the server runs.
   */
  it('reads the year in UTC, so 1 January is not filed under the year before', async () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/Chicago';
    try {
      await workCalendarRepository.createHoliday({
        companyId: 'company-1', date: '2026-01-01', name: 'Tahun Baru Masehi', type: 'NH',
      });
      expect(created().year).toBe(2026);
    } finally {
      process.env.TZ = tz;
    }
  });

  it('moves the year with the date on update', async () => {
    await workCalendarRepository.updateHoliday('holiday-1', { date: '2027-01-01' });
    expect(updated().year).toBe(2027);
    expect(updated().date).toEqual(new Date('2027-01-01'));
  });

  it('refuses to set the year on its own, which is how the two drifted apart', async () => {
    await workCalendarRepository.updateHoliday('holiday-1', { year: 2030 });
    expect(updated()).not.toHaveProperty('year');
  });

  it('rejects a date that is not a date rather than storing NaN', async () => {
    await expect(
      workCalendarRepository.createHoliday({
        companyId: 'company-1', date: 'not-a-date', name: 'Nonsense', type: 'NH',
      }),
    ).rejects.toThrow(/valid calendar date/);
    expect(prismaMock.nationalHoliday.create).not.toHaveBeenCalled();
  });

  it('scopes the list to the company it is given', async () => {
    prismaMock.nationalHoliday.findMany.mockResolvedValue([]);
    await workCalendarRepository.findAllHolidays('company-1', 2026);
    expect(prismaMock.nationalHoliday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-1', year: 2026 } }),
    );
  });
});
