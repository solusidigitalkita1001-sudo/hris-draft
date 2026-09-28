import { parseWorkweekDays, DEFAULT_COMPANY_SETTINGS } from './company-settings.service';

describe('parseWorkweekDays', () => {
  it('menerima nilai 5 dan 6', () => {
    expect(parseWorkweekDays('5')).toBe(5);
    expect(parseWorkweekDays('6')).toBe(6);
  });

  it('fallback ke 5 untuk nilai di luar 5/6 atau tidak valid', () => {
    expect(parseWorkweekDays('7')).toBe(5);
    expect(parseWorkweekDays('4')).toBe(5);
    expect(parseWorkweekDays('0')).toBe(5);
    expect(parseWorkweekDays('-6')).toBe(5);
    expect(parseWorkweekDays('abc')).toBe(5);
    expect(parseWorkweekDays('')).toBe(5);
    expect(parseWorkweekDays('6.5')).toBe(5);
  });

  it('default company setting attendance_workweek_days tersedia dan valid', () => {
    expect(DEFAULT_COMPANY_SETTINGS.attendance_workweek_days).toBeDefined();
    expect(parseWorkweekDays(DEFAULT_COMPANY_SETTINGS.attendance_workweek_days)).toBe(5);
  });
});
