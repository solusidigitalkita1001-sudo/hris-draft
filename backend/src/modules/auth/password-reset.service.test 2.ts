jest.mock('./auth.repository', () => ({ authRepository: {
  findPasswordResetUserByEmail: jest.fn(),
  findRecentPasswordResetToken: jest.fn(),
  createPasswordResetToken: jest.fn(),
  markPasswordResetTokenUsed: jest.fn(),
  findValidPasswordResetToken: jest.fn(),
  consumePasswordResetToken: jest.fn(),
} }));
jest.mock('@/shared/security/PasswordHandler', () => ({ passwordHandler: {
  validate: jest.fn(), compare: jest.fn(), hash: jest.fn(),
} }));
jest.mock('@/shared/mail/MailService', () => ({ mailService: { sendPasswordReset: jest.fn() } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ WinstonLogger: jest.fn().mockImplementation(() => ({
  warn: jest.fn(), error: jest.fn(), security: jest.fn(),
})) }));

import { createHash } from 'node:crypto';
import { authRepository } from './auth.repository';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { mailService } from '@/shared/mail/MailService';
import { eventBus } from '@/shared/events/EventBus';
import { PasswordResetService } from './password-reset.service';

const repository = jest.mocked(authRepository);
const passwords = jest.mocked(passwordHandler);
const mail = jest.mocked(mailService);
const events = jest.mocked(eventBus);
const service = new PasswordResetService();

describe('PasswordResetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findRecentPasswordResetToken.mockResolvedValue(null);
    repository.markPasswordResetTokenUsed.mockResolvedValue({ count: 1 } as never);
    events.publish.mockResolvedValue(undefined);
  });

  it('returns the same silent result for an unknown email', async () => {
    repository.findPasswordResetUserByEmail.mockResolvedValue(null);

    await expect(service.requestPasswordReset({ email: 'missing@example.test' }, '127.0.0.1'))
      .resolves.toBeUndefined();
    expect(repository.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('stores only a digest and sends the raw token once', async () => {
    repository.findPasswordResetUserByEmail.mockResolvedValue({ id: 'user-1', email: 'user@example.test', status: 'ACTIVE' });
    repository.createPasswordResetToken.mockResolvedValue({ id: 'reset-1' } as never);
    mail.sendPasswordReset.mockResolvedValue(true);

    await service.requestPasswordReset({ email: 'user@example.test' }, '127.0.0.1');

    const rawToken = mail.sendPasswordReset.mock.calls[0][1];
    const stored = repository.createPasswordResetToken.mock.calls[0][0];
    expect(rawToken).toHaveLength(43);
    expect(stored.tokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(rawToken);
    expect(repository.markPasswordResetTokenUsed).not.toHaveBeenCalled();
  });

  it('invalidates a grant that cannot be delivered', async () => {
    repository.findPasswordResetUserByEmail.mockResolvedValue({ id: 'user-1', email: 'user@example.test', status: 'ACTIVE' });
    repository.createPasswordResetToken.mockResolvedValue({ id: 'reset-1' } as never);
    mail.sendPasswordReset.mockResolvedValue(false);

    await service.requestPasswordReset({ email: 'user@example.test' });

    expect(repository.markPasswordResetTokenUsed).toHaveBeenCalledWith('reset-1');
  });

  it('does not create or deliver another grant during the account throttle window', async () => {
    repository.findPasswordResetUserByEmail.mockResolvedValue({ id: 'user-1', email: 'user@example.test', status: 'ACTIVE' });
    repository.findRecentPasswordResetToken.mockResolvedValue({ id: 'recent-reset' });

    await service.requestPasswordReset({ email: 'user@example.test' });

    expect(repository.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('resets the password through the atomic consume path', async () => {
    repository.findValidPasswordResetToken.mockResolvedValue({
      id: 'reset-1', userId: 'user-1',
      user: { passwordHash: 'old-hash', status: 'ACTIVE', deletedAt: null },
    });
    passwords.compare.mockResolvedValue(false);
    passwords.hash.mockResolvedValue('new-hash');
    repository.consumePasswordResetToken.mockResolvedValue('user-1');

    await service.resetPassword({ token: 'raw-reset-token', password: 'NewPassword1!' });

    const digest = createHash('sha256').update('raw-reset-token').digest('hex');
    expect(passwords.validate).toHaveBeenCalledWith('NewPassword1!');
    expect(repository.findValidPasswordResetToken).toHaveBeenCalledWith(digest);
    expect(repository.consumePasswordResetToken).toHaveBeenCalledWith(digest, 'new-hash');
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({
      name: 'auth.password.changed', aggregateId: 'user-1',
    }));
  });

  it('rejects invalid, expired, or already consumed tokens', async () => {
    repository.findValidPasswordResetToken.mockResolvedValue(null);

    await expect(service.resetPassword({ token: 'invalid', password: 'NewPassword1!' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'PASSWORD_RESET_INVALID' });
    expect(repository.consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    repository.findValidPasswordResetToken.mockResolvedValue({
      id: 'reset-1', userId: 'user-1',
      user: { passwordHash: 'same-hash', status: 'ACTIVE', deletedAt: null },
    });
    passwords.compare.mockResolvedValue(true);

    await expect(service.resetPassword({ token: 'valid', password: 'SamePassword1!' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repository.consumePasswordResetToken).not.toHaveBeenCalled();
  });
});
