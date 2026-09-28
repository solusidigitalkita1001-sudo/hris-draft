import config from '@/config';
import { buildPasswordResetMessage } from './MailService';

describe('password reset email', () => {
  it('places the opaque token only in the configured reset URL', () => {
    const originalUrl = config.passwordReset.url;
    config.passwordReset.url = 'https://mobile.example.test/reset-password?source=email';
    try {
      const message = buildPasswordResetMessage('opaque+/token?value');
      const urlText = message.text.split('\n').find((line) => line.startsWith('https://'));
      expect(urlText).toBeDefined();
      const url = new URL(urlText as string);

      expect(url.origin + url.pathname).toBe('https://mobile.example.test/reset-password');
      expect(url.searchParams.get('source')).toBe('email');
      expect(url.searchParams.get('token')).toBe('opaque+/token?value');
      expect(message.subject).not.toContain('opaque');
    } finally {
      config.passwordReset.url = originalUrl;
    }
  });
});
