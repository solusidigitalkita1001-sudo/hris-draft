import { isRefreshTokenIdleExpired } from './session-idle';

describe('isRefreshTokenIdleExpired', () => {
  const issued = new Date('2026-09-27T08:00:00Z');
  const minutesLater = (m: number) => new Date(issued.getTime() + m * 60_000);

  it('belum melewati batas idle → tidak expired', () => {
    expect(isRefreshTokenIdleExpired(issued, minutesLater(29), 30)).toBe(false);
    expect(isRefreshTokenIdleExpired(issued, minutesLater(30), 30)).toBe(false);
  });

  it('melewati batas idle → expired', () => {
    expect(isRefreshTokenIdleExpired(issued, minutesLater(31), 30)).toBe(true);
    expect(isRefreshTokenIdleExpired(issued, minutesLater(60 * 24), 30)).toBe(true);
  });

  it('batas nol/negatif/non-finite menonaktifkan pemeriksaan', () => {
    expect(isRefreshTokenIdleExpired(issued, minutesLater(9999), 0)).toBe(false);
    expect(isRefreshTokenIdleExpired(issued, minutesLater(9999), -5)).toBe(false);
    expect(isRefreshTokenIdleExpired(issued, minutesLater(9999), Number.NaN)).toBe(false);
  });
});
