import express from 'express';
import type { Request, Response, NextFunction } from 'express';

jest.mock('./attendance-device.service', () => ({
  attendanceDeviceService: {
    authenticate: jest.fn(),
    ingest: jest.fn(async () => []),
    register: jest.fn(async () => ({ device: { id: 'device-1', name: 'Lobi', serialNumber: 'ZK-1', branchId: null, isActive: true }, token: 'device-1.secret' })),
    list: jest.fn(async () => []),
    update: jest.fn(async () => ({ id: 'device-1', name: 'Lobi', isActive: false, branchId: null })),
    punchLog: jest.fn(async () => []),
  },
}));

let sessionUser: { id: string; companyId: string } | null = { id: 'user-1', companyId: 'company-a' };

jest.mock('@/shared/middleware/Authenticate', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    if (!sessionUser) return next(new (require('@/shared/exceptions/AppError').AuthError)('No authorization token provided'));
    req.user = sessionUser;
    next();
  },
}));
jest.mock('@/shared/middleware/CompanyScope', () => ({ requireCompanyAccess: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
jest.mock('@/shared/middleware/Authorize', () => ({ authorize: () => (_req: Request, _res: Response, next: NextFunction) => next() }));

import attendanceDeviceRoutes from './attendance-device.routes';
import { attendanceDeviceService } from './attendance-device.service';
import { errorHandler } from '@/shared/middleware/ErrorHandler';
import { AuthError } from '@/shared/exceptions/AppError';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

function testApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/attendance-devices', attendanceDeviceRoutes);
  app.use(errorHandler);
  return app;
}

const punchBody = {
  punches: [{ employeeCode: 'EMP001', externalId: 'p-1', punchedAt: '2026-09-30T01:00:00.000Z' }],
};

describe('attendance device routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionUser = { id: 'user-1', companyId: 'company-a' };
    jest.mocked(attendanceDeviceService.authenticate).mockResolvedValue({
      id: 'device-1', companyId: 'company-a', branchId: null, serialNumber: 'ZK-1', name: 'Lobi',
    });
  });

  it('refuses a punch with no device credential', async () => {
    const response = await request(testApp()).post('/api/v1/attendance-devices/punches').send(punchBody).expect(401);
    expect(response.body.error?.code ?? response.body.code).toBe('AUTHENTICATION_FAILED');
    expect(attendanceDeviceService.ingest).not.toHaveBeenCalled();
  });

  it('refuses a punch carrying a user session instead of a device credential', async () => {
    await request(testApp())
      .post('/api/v1/attendance-devices/punches')
      .set('Authorization', 'Bearer a-user-access-token')
      .send(punchBody)
      .expect(401);
    expect(attendanceDeviceService.ingest).not.toHaveBeenCalled();
  });

  it('accepts a punch from a verified terminal', async () => {
    await request(testApp())
      .post('/api/v1/attendance-devices/punches')
      .set('Authorization', 'Device device-1.secret')
      .send(punchBody)
      .expect(200);
    expect(attendanceDeviceService.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'device-1', companyId: 'company-a' }),
      [expect.objectContaining({ employeeCode: 'EMP001', direction: 'AUTO' })],
    );
  });

  it('validates the punch payload before any ingestion', async () => {
    await request(testApp())
      .post('/api/v1/attendance-devices/punches')
      .set('Authorization', 'Device device-1.secret')
      .send({ punches: [{ employeeCode: '', externalId: 'p-1', punchedAt: 'not-a-date' }] })
      .expect(422);
    expect(attendanceDeviceService.ingest).not.toHaveBeenCalled();
  });

  /**
   * The inverse of the first two: a device credential is not a session. An HR
   * endpoint must not accept one, or registering terminals becomes something a
   * stolen terminal secret can do.
   */
  it('refuses device credentials on the HR endpoints', async () => {
    sessionUser = null;
    await request(testApp())
      .get('/api/v1/attendance-devices')
      .set('Authorization', 'Device device-1.secret')
      .expect(401);
    expect(attendanceDeviceService.list).not.toHaveBeenCalled();
  });

  it('returns the token exactly once, on registration', async () => {
    const response = await request(testApp())
      .post('/api/v1/attendance-devices')
      .send({ name: 'Lobi', serialNumber: 'ZK-1' })
      .expect(201);

    expect(response.body.data.token).toBe('device-1.secret');
    expect(response.body.message).toMatch(/not retrievable later/i);

    const list = await request(testApp()).get('/api/v1/attendance-devices').expect(200);
    expect(JSON.stringify(list.body)).not.toContain('secret');
  });

  it('propagates an authentication failure from the credential check', async () => {
    jest.mocked(attendanceDeviceService.authenticate).mockRejectedValue(new AuthError('Invalid device credential'));
    await request(testApp())
      .post('/api/v1/attendance-devices/punches')
      .set('Authorization', 'Device device-1.wrong')
      .send(punchBody)
      .expect(401);
  });
});
