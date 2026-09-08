jest.mock('./travel-expense.service', () => ({
  travelExpenseService: {
    findMyTrips: jest.fn().mockResolvedValue([]),
    findMyClaims: jest.fn().mockResolvedValue([]),
    createTrip: jest.fn().mockResolvedValue({ id: 'trip' }),
    createClaim: jest.fn().mockResolvedValue({ id: 'claim' }),
  },
}));
jest.mock('@/shared/database/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/config', () => ({ __esModule: true, default: { app: { url: 'http://localhost:3000' } } }));

import { Response } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { prisma } from '@/shared/database/prisma';
import { TravelExpenseController } from './travel-expense.controller';
import { createBusinessTripSchema, createExpenseClaimSchema } from './travel-expense.dto';
import { travelExpenseService } from './travel-expense.service';

const controller = new TravelExpenseController();
const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
const actor = { id: 'user', companyId: 'company', employeeId: 'self' };
const tripBody = {
  destination: 'Jakarta', purpose: 'Client meeting',
  startDate: '2026-09-10', endDate: '2026-09-12', estimatedCost: 500000,
};
const claimBody = { category: 'MEAL', amount: 50000, expenseDate: '2026-09-10' };

describe('travel self-service actor contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['trip', createBusinessTripSchema, tripBody, 'createTrip'],
    ['claim', createExpenseClaimSchema, claimBody, 'createClaim'],
  ] as const)('accepts a %s request without client actor fields', async (_name, schema, body, method) => {
    const parsed = schema.parse(body);
    const next = jest.fn();
    await controller[method]({ user: actor, body: parsed } as unknown as AuthenticatedRequest, res, next);

    expect(travelExpenseService[method]).toHaveBeenCalledWith({ ...body, companyId: 'company', employeeId: 'self' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['trip', createBusinessTripSchema, tripBody, 'createTrip'],
    ['claim', createExpenseClaimSchema, claimBody, 'createClaim'],
  ] as const)('ignores forged employee identity for a %s create', async (_name, schema, body, method) => {
    const parsed = schema.parse({ ...body, employeeId: 'forged' });
    expect(parsed).not.toHaveProperty('employeeId');

    await controller[method]({
      user: actor,
      body: { ...parsed, employeeId: 'forged', companyId: 'other-company' },
    } as unknown as AuthenticatedRequest, res, jest.fn());
    expect(travelExpenseService[method]).toHaveBeenCalledWith({ ...body, companyId: 'company', employeeId: 'self' });
  });

  it.each(['findMyTrips', 'findMyClaims'] as const)('%s ignores the legacy employeeId query', async (method) => {
    const next = jest.fn();
    await controller[method]({
      user: actor, query: { employeeId: 'forged', status: 'APPROVED' },
    } as unknown as AuthenticatedRequest, res, next);
    expect(travelExpenseService[method]).toHaveBeenCalledWith('self', 'APPROVED');
    expect(next).not.toHaveBeenCalled();
  });

  it('resolves the employee from the authenticated account when the session has no employeeId', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ employeeId: 'linked-employee' });
    await controller.createTrip({
      user: { id: 'user', companyId: 'company' }, body: createBusinessTripSchema.parse(tripBody),
    } as unknown as AuthenticatedRequest, res, jest.fn());
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user' }, select: { employeeId: true } });
    expect(travelExpenseService.createTrip).toHaveBeenCalledWith({ ...tripBody, companyId: 'company', employeeId: 'linked-employee' });
  });

  it.each(['createTrip', 'createClaim'] as const)('%s rejects an account with no employee profile', async (method) => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ employeeId: null });
    const next = jest.fn();
    await controller[method]({
      user: { id: 'user', companyId: 'company' }, body: method === 'createTrip' ? tripBody : claimBody,
    } as unknown as AuthenticatedRequest, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(travelExpenseService[method]).not.toHaveBeenCalled();
  });
});
