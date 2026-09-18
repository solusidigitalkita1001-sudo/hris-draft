import {
  myAttendanceQuerySchema,
  overtimeRequestSchema,
  selfCheckInSchema,
  selfCheckOutSchema,
} from './attendance.dto';
import { createAttendanceCorrectionSchema } from './attendance-correction.dto';

describe('mobile attendance contracts', () => {
  it('parses bounded pagination and a YYYY-MM month', () => {
    expect(myAttendanceQuerySchema.parse({ month: '2026-09', page: '2', limit: '25' }))
      .toEqual({ month: '2026-09', page: 2, limit: 25 });
    expect(() => myAttendanceQuerySchema.parse({ month: '09-2026' })).toThrow();
  });

  it('strips client-controlled identity and timestamps from self check-in', () => {
    const parsed = selfCheckInSchema.parse({
      method: 'MOBILE_GPS',
      checkInLatitude: -6.2,
      checkInLongitude: 106.8,
      employeeId: '00000000-0000-4000-8000-000000000001',
      companyId: '00000000-0000-4000-8000-000000000002',
      date: '2000-01-01T00:00:00.000Z',
      checkIn: '2000-01-01T00:00:00.000Z',
      status: 'PRESENT',
    });
    expect(parsed).toEqual({
      method: 'MOBILE_GPS',
      checkInLatitude: -6.2,
      checkInLongitude: 106.8,
    });
  });

  it('strips a client checkout timestamp', () => {
    expect(selfCheckOutSchema.parse({
      method: 'MOBILE_GPS',
      checkOut: '2000-01-01T00:00:00.000Z',
      checkOutLatitude: -6.2,
      checkOutLongitude: 106.8,
      deviceGps: { isMockLocation: false, accuracyMeters: 8 },
    })).toEqual({
      method: 'MOBILE_GPS',
      checkOutLatitude: -6.2,
      checkOutLongitude: 106.8,
      deviceGps: { isMockLocation: false, accuracyMeters: 8 },
    });
  });

  it('allows self overtime without accepting a company identity', () => {
    const parsed = overtimeRequestSchema.parse({
      companyId: '00000000-0000-4000-8000-000000000002',
      date: '2026-09-17T00:00:00.000Z',
      startTime: '2026-09-17T10:00:00.000Z',
      endTime: '2026-09-17T12:00:00.000Z',
      durationHours: 2,
      reason: 'Month-end work',
    });
    expect(parsed).not.toHaveProperty('companyId');
    expect(parsed.employeeId).toBeUndefined();
  });

  it('requires at least one corrected timestamp', () => {
    expect(() => createAttendanceCorrectionSchema.parse({
      date: '2026-09-17T00:00:00.000Z',
      reason: 'Clock was offline',
    })).toThrow(/Minimal satu/);
  });
});
