import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';

/**
 * Roles, permissions and company scope are carried in the access token, so a
 * revocation only took effect when that token expired — up to the access-token
 * lifetime of stale authority after an admin removed a role. `authenticate()`
 * already rejects a token whose `sessionVersion` no longer matches the user
 * row, and `/auth/refresh` re-reads the user and mints fresh claims without
 * consulting that version. Bumping the version therefore retires the stale
 * token at the next request and the client's own refresh replaces it — the user
 * keeps their session, with the authority they now actually have.
 *
 * User deactivation and password changes are already enforced on every request,
 * so they do not need this.
 */
async function bump(where: { id: string } | { userRoles: { some: { roleId: string } } }, reason: string): Promise<number> {
  const { count } = await prisma.user.updateMany({ where, data: { sessionVersion: { increment: 1 } } });
  if (count > 0) logger.info('Active sessions revoked after an authority change', { reason, users: count });
  return count;
}

/** Retire the access tokens of one user after their own grants changed. */
export function revokeSessionsForUser(userId: string, reason: string): Promise<number> {
  return bump({ id: userId }, reason);
}

/**
 * Retire the access tokens of every user holding a role whose permission set
 * changed. One edit to a role reaches everyone who holds it, which is exactly
 * why the stale-claim window mattered here.
 */
export function revokeSessionsForRole(roleId: string, reason: string): Promise<number> {
  return bump({ userRoles: { some: { roleId } } }, reason);
}
