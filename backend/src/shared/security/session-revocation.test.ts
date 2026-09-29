let updateMany: jest.Mock;
jest.mock('@/shared/database/prisma', () => {
  updateMany = jest.fn(async () => ({ count: 1 }));
  const client = { user: { updateMany } };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));

import { logger } from '@/shared/logger/WinstonLogger';
import { revokeSessionsForRole, revokeSessionsForUser } from './session-revocation';

/**
 * Roles, permissions and company scope ride in the access token. Without a
 * session-version bump, an admin's revocation only took effect when that token
 * expired, leaving the holder with authority they no longer had.
 */
describe('session revocation after an authority change', () => {
  beforeEach(() => {
    updateMany.mockClear();
    updateMany.mockResolvedValue({ count: 1 });
    jest.mocked(logger.info).mockClear();
  });

  it('bumps the version of one user', async () => {
    await expect(revokeSessionsForUser('user-a', 'user-roles-assigned')).resolves.toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'user-a' }, data: { sessionVersion: { increment: 1 } },
    });
  });

  it('bumps every holder of a role whose permissions changed', async () => {
    updateMany.mockResolvedValue({ count: 12 });

    await expect(revokeSessionsForRole('role-hr', 'role-permissions-changed')).resolves.toBe(12);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userRoles: { some: { roleId: 'role-hr' } } },
      data: { sessionVersion: { increment: 1 } },
    });
  });

  it('records the reason and how many sessions were retired', async () => {
    updateMany.mockResolvedValue({ count: 3 });

    await revokeSessionsForRole('role-hr', 'role-permissions-changed');

    expect(logger.info).toHaveBeenCalledWith(
      'Active sessions revoked after an authority change',
      { reason: 'role-permissions-changed', users: 3 },
    );
  });

  it('stays quiet when the change affected nobody', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(revokeSessionsForRole('role-unused', 'role-permissions-changed')).resolves.toBe(0);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
