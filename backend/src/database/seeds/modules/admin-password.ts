import { passwordHandler } from '@/shared/security/PasswordHandler';

/**
 * Resolves the password to seed the SUPER_ADMIN (`admin@hrms.com`) account
 * with.
 *
 * S-M2: the seed used to hash a literal `'Admin123!'` for every deployment,
 * with `mustChangePassword: false` — a published, reusable credential. An
 * operator can now pin a known password via `SEED_ADMIN_PASSWORD` (e.g. for
 * provisioning automation); left unset, a fresh cryptographically random
 * password is generated on every run instead.
 *
 * Pure function: no DB access, so it is directly unit-testable.
 */
export interface ResolvedAdminPassword {
  password: string;
  wasGenerated: boolean;
}

export function resolveAdminPassword(
  env: { SEED_ADMIN_PASSWORD?: string } = process.env
): ResolvedAdminPassword {
  const fromEnv = env.SEED_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.trim().length > 0) {
    return { password: fromEnv, wasGenerated: false };
  }
  return { password: passwordHandler.generateRandomPassword(), wasGenerated: true };
}
