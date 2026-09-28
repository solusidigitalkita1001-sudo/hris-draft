import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authRepository } from './auth.repository';
import type { ForgotPasswordDTO, ResetPasswordDTO } from './auth.dto';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { mailService } from '@/shared/mail/MailService';
import { AppError, ConflictError } from '@/shared/exceptions/AppError';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import config from '@/config';

const logger = new WinstonLogger('PasswordResetService');
const REQUEST_THROTTLE_MS = 60_000;

function tokenDigest(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function invalidResetToken(): AppError {
  return new AppError(
    'Password reset token is invalid or expired',
    400,
    'PASSWORD_RESET_INVALID',
    true,
  );
}

export class PasswordResetService {
  /**
   * Always resolves without revealing whether an account exists. Provider
   * failures are logged without the email/token and invalidate the grant.
   */
  async requestPasswordReset(input: ForgotPasswordDTO, ipAddress?: string): Promise<void> {
    const user = await authRepository.findPasswordResetUserByEmail(input.email);
    if (!user || !['ACTIVE', 'LOCKED'].includes(user.status)) return;

    const recent = await authRepository.findRecentPasswordResetToken(
      user.id,
      new Date(Date.now() - REQUEST_THROTTLE_MS),
    );
    if (recent) return;

    const rawToken = randomBytes(32).toString('base64url');
    const token = await authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: tokenDigest(rawToken),
      expiresAt: new Date(Date.now() + config.passwordReset.ttlMinutes * 60_000),
      requestedIp: ipAddress,
    });

    try {
      const delivered = await mailService.sendPasswordReset(user.email, rawToken);
      if (!delivered) {
        await authRepository.markPasswordResetTokenUsed(token.id);
        logger.warn('Password reset delivery disabled by configuration', { userId: user.id });
      }
    } catch (error) {
      await authRepository.markPasswordResetTokenUsed(token.id).catch(() => undefined);
      logger.error('Password reset delivery failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown mail delivery error',
      });
    }
  }

  async resetPassword(input: ResetPasswordDTO): Promise<void> {
    passwordHandler.validate(input.password);
    const digest = tokenDigest(input.token);
    const resetToken = await authRepository.findValidPasswordResetToken(digest);
    if (
      !resetToken ||
      resetToken.user.deletedAt ||
      ['INACTIVE', 'SUSPENDED'].includes(resetToken.user.status)
    ) {
      throw invalidResetToken();
    }

    if (await passwordHandler.compare(input.password, resetToken.user.passwordHash)) {
      throw new ConflictError('New password must be different from current password');
    }

    const passwordHash = await passwordHandler.hash(input.password);
    const userId = await authRepository.consumePasswordResetToken(digest, passwordHash);
    if (!userId) throw invalidResetToken();

    logger.security(`Password reset completed for user ${userId}`);
    try {
      await eventBus.publish({
        name: DomainEvents.PASSWORD_CHANGED,
        aggregateId: userId,
        aggregateType: 'User',
        data: { source: 'password-reset' },
        metadata: {
          eventId: randomUUID(),
          occurredAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Password reset event publication failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown event error',
      });
    }
  }
}

export const passwordResetService = new PasswordResetService();
