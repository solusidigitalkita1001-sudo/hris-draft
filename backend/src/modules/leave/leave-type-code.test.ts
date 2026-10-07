jest.mock('./leave.repository', () => ({
  leaveRepository: {
    findLeaveTypeByCode: jest.fn(),
    createLeaveType: jest.fn(),
  },
}));
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ConflictError } from '@/shared/exceptions/AppError';
import { leaveRepository } from './leave.repository';
import { leaveService } from './leave.service';

const repo = leaveRepository as unknown as {
  findLeaveTypeByCode: jest.Mock;
  createLeaveType: jest.Mock;
};

const payload = {
  companyId: 'company-1',
  name: 'Cuti Tahunan',
  code: 'ANNUAL',
  isPaid: true,
  isAnnual: true,
  maxDays: 12,
  requiresAttachment: false,
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  repo.findLeaveTypeByCode.mockResolvedValue(null);
  repo.createLeaveType.mockImplementation(async (data: unknown) => ({ id: 'type-1', ...(data as object) }));
});

describe('leave type code conflict', () => {
  it('creates when the code is free', async () => {
    const created = await leaveService.createLeaveType(payload);

    expect(created).toMatchObject({ code: 'ANNUAL' });
  });

  it('answers 409 instead of dying on the unique index', async () => {
    // ANNUAL, SICK and UNPAID are codes every tenant wants, so a collision is an
    // everyday event. Before this check the insert reached the database and the
    // caller saw a raw constraint error.
    repo.findLeaveTypeByCode.mockResolvedValue({ id: 'existing' });

    await expect(leaveService.createLeaveType(payload)).rejects.toThrow(ConflictError);
    expect(repo.createLeaveType).not.toHaveBeenCalled();
  });

  it('asks the question scoped to one company', async () => {
    await leaveService.createLeaveType(payload);

    expect(repo.findLeaveTypeByCode).toHaveBeenCalledWith('company-1', 'ANNUAL');
  });
});
