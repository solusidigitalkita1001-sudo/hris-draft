const mockModel = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  upsert: jest.fn().mockResolvedValue({}),
});
const mockClient: any = {
  payrollUnlockGuard: mockModel(),
  payrollUnlockSession: mockModel(),
  user: mockModel(),
};
mockClient.$transaction = jest.fn(async (callback: (tx: typeof mockClient) => unknown) => callback(mockClient));
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: mockClient, prisma: mockClient }));
jest.mock('@/shared/security/PasswordHandler', () => ({
  passwordHandler: { compare: jest.fn() },
}));

import crypto from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import {
  PAYROLL_UNLOCK_MAX_ATTEMPTS,
  PayrollUnlockService,
} from './payroll-unlock.service';

const companyId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const employeeId = '33333333-3333-4333-8333-333333333333';
const actor = { id: userId, companyId, employeeId };

describe('PayrollUnlockService', () => {
  const service = new PayrollUnlockService();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prisma.payrollUnlockGuard.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.user.findFirst).mockResolvedValue({
      passwordHash: 'hash',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      lockedUntil: null,
      employee: { companyId },
    } as never);
  });

  it('stores only a digest and returns a five-minute bearer grant after reauthentication', async () => {
    jest.mocked(passwordHandler.compare).mockResolvedValue(true);
    const result = await service.unlock(actor, { password: 'correct-password' });

    expect(result.unlockToken).toHaveLength(43);
    expect(result.expiresIn).toBe(300);
    const create = jest.mocked(prisma.payrollUnlockSession.create).mock.calls[0][0].data;
    expect(create.tokenHash).toBe(crypto.createHash('sha256').update(result.unlockToken).digest('hex'));
    expect(JSON.stringify(create)).not.toContain(result.unlockToken);
    expect(prisma.payrollUnlockSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { revokedAt: expect.any(Date) },
    }));
  });

  it('fails closed when a grant is missing', async () => {
    await expect(service.assertGrant(actor, undefined)).rejects.toMatchObject({
      statusCode: 401,
      code: 'PAYROLL_UNLOCK_REQUIRED',
    });
  });

  it('locks payroll unlock for fifteen minutes on the fifth failed attempt', async () => {
    jest.mocked(passwordHandler.compare).mockResolvedValue(false);
    jest.mocked(prisma.payrollUnlockGuard.findUnique).mockResolvedValue({
      failedAttempts: PAYROLL_UNLOCK_MAX_ATTEMPTS - 1,
      lockedUntil: null,
      updatedAt: new Date(),
    } as never);
    jest.mocked(prisma.payrollUnlockGuard.upsert).mockResolvedValueOnce({
      id: 'guard-1',
      failedAttempts: PAYROLL_UNLOCK_MAX_ATTEMPTS,
    } as never);

    await expect(service.unlock(actor, { password: 'wrong-password' })).rejects.toMatchObject({
      statusCode: 429,
      code: 'PAYROLL_UNLOCK_LOCKED',
    });
    expect(prisma.payrollUnlockGuard.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { failedAttempts: { increment: 1 } },
    }));
    expect(prisma.payrollUnlockGuard.update).toHaveBeenCalledWith({
      where: { id: 'guard-1' },
      data: { lockedUntil: expect.any(Date) },
    });
  });

  it('revokes every active grant when relocked', async () => {
    await service.lock(actor);
    expect(prisma.payrollUnlockSession.updateMany).toHaveBeenCalledWith({
      where: { companyId, userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
