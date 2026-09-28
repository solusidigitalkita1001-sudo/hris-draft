import express from 'express';
import type { NextFunction, Request, Response } from 'express';

jest.mock('@/shared/middleware/Authenticate', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { id: 'user-1', companyId: 'company-a', employeeId: 'employee-1' };
    next();
  },
}));
jest.mock('@/shared/middleware/CompanyScope', () => ({
  requireCompanyAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('@/shared/middleware/Idempotency', () => ({
  idempotency: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('./announcement.service', () => ({ announcementService: {
  list: jest.fn(), unreadCount: jest.fn(), detail: jest.fn(), markRead: jest.fn(),
} }));

import announcementRoutes from './announcement.routes';
import { announcementService } from './announcement.service';
import { errorHandler } from '@/shared/middleware/ErrorHandler';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const service = jest.mocked(announcementService);

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v1/announcements', announcementRoutes);
  instance.use(errorHandler);
  return instance;
}

describe('announcement mobile routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes pagination and returns the standard list envelope', async () => {
    service.list.mockResolvedValue({ items: [{ id: 'a' }], total: 1, page: 2, limit: 5 } as never);

    const response = await request(app()).get('/api/v1/announcements?page=2&limit=5&unreadOnly=true').expect(200);

    expect(service.list).toHaveBeenCalledWith(
      { userId: 'user-1', companyId: 'company-a', employeeId: 'employee-1' },
      { page: 2, limit: 5, unreadOnly: 'true' },
    );
    expect(response.body.meta).toMatchObject({ page: 2, limit: 5, total: 1 });
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('returns unread count and validates detail IDs', async () => {
    service.unreadCount.mockResolvedValue(3);
    const response = await request(app()).get('/api/v1/announcements/unread-count').expect(200);
    expect(response.body).toEqual(expect.objectContaining({ data: { count: 3 } }));
    await request(app()).get('/api/v1/announcements/not-a-uuid').expect(422);
    expect(service.detail).not.toHaveBeenCalled();
  });

  it('marks a visible announcement as read', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    service.markRead.mockResolvedValue({ announcementId: id, readAt: new Date(), alreadyRead: false });

    await request(app()).put(`/api/v1/announcements/${id}/read`).expect(200);

    expect(service.markRead).toHaveBeenCalledWith(
      { userId: 'user-1', companyId: 'company-a', employeeId: 'employee-1' },
      id,
    );
  });
});
