import { passwordHandler } from '@/shared/security/PasswordHandler';
import { ValidationError } from '@/shared/exceptions/AppError';

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
 * Fix-review I1: an env-supplied value used to be trusted verbatim, so
 * `SEED_ADMIN_PASSWORD=a` would have become a valid, login-usable password
 * for the global SUPER_ADMIN account — the repo's password policy
 * (`passwordHandler.validate`) is only enforced on self-service change/reset,
 * never on login. It is now run through that same validator here, and a
 * failure throws a `ValidationError` with per-field messages, which fails
 * the whole seed run loudly instead of quietly seeding a weak credential.
 *
 * Fix-review M2: a value with leading/trailing whitespace is REJECTED, not
 * silently trimmed. Silent trimming would let an operator believe they set
 * `SEED_ADMIN_PASSWORD=" Secret123! "` (e.g. a stray newline from a secrets
 * manager, a heredoc, or a copy-paste) and have the seed quietly use a
 * DIFFERENT password than the one they typed, with no feedback that
 * anything changed — the worst kind of surprise for a credential. Rejecting
 * forces them to notice and fix the value instead. A pure whitespace-only
 * value (no real content) is treated the same as unset, since there is
 * nothing there to warn about trimming.
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
  const raw = env.SEED_ADMIN_PASSWORD;

  if (raw === undefined) {
    return { password: passwordHandler.generateRandomPassword(), wasGenerated: true };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    // Empty or whitespace-only: nothing was meaningfully set, treat as unset.
    return { password: passwordHandler.generateRandomPassword(), wasGenerated: true };
  }

  if (raw !== trimmed) {
    throw new ValidationError('SEED_ADMIN_PASSWORD validation failed', [
      {
        field: 'SEED_ADMIN_PASSWORD',
        message:
          'must not have leading or trailing whitespace (rejected rather than silently trimmed — ' +
          'fix the value so the password you set is the password that gets seeded)',
      },
    ]);
  }

  // Throws ValidationError with per-field messages if the operator-chosen
  // password does not meet the repo's password policy.
  passwordHandler.validate(raw);

  return { password: raw, wasGenerated: false };
}
