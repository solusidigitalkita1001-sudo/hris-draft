import type { Response } from 'express';
import { runInRequestContext } from '@/shared/context/RequestContext';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { DailyActivityController } from './daily-activity.controller';
import { dailyActivityService } from './daily-activity.service';

jest.mock('./daily-activity.service', () => ({
  dailyActivityService: { findAll: jest.fn() },
}));

describe('daily activity list company context', () => {
  const controller = new DailyActivityController();
  const req = { query: {} } as Parameters<DailyActivityController['listRequests']>[0];
  const json = jest.fn();
  const res = { json } as unknown as Response;
  const next = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, null, ''])('denies missing active company %p before querying activities', async companyId => {
    await runInRequestContext({
      user: { id: 'user-a', email: 'a@example.com', companyId },
    }, () => controller.listRequests(req, res, next));

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(dailyActivityService.findAll).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('denies requests without authentication context before querying activities', async () => {
    await controller.listRequests(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(dailyActivityService.findAll).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('queries the active company from request context', async () => {
    jest.mocked(dailyActivityService.findAll).mockResolvedValue([]);

    await runInRequestContext({
      user: { id: 'user-a', email: 'a@example.com', companyId: 'company-a' },
    }, () => controller.listRequests(req, res, next));

    expect(dailyActivityService.findAll).toHaveBeenCalledWith('company-a', req.query);
    expect(json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(next).not.toHaveBeenCalled();
  });
});
