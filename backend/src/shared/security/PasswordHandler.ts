import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import config from '@/config';
import { ValidationError } from '@/shared/exceptions/AppError';

export class PasswordHandler {
  private static instance: PasswordHandler;

  private constructor() {}

  static getInstance(): PasswordHandler {
    if (!PasswordHandler.instance) {
      PasswordHandler.instance = new PasswordHandler();
    }
    return PasswordHandler.instance;
  }

  // Task 1.5 (SEC-014): all new hashes are Argon2id. Legacy bcrypt hashes are
  // still verifiable so existing users can log in and be transparently rehashed.
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async compare(password: string, hash: string): Promise<boolean> {
    if (hash.startsWith('$argon2')) {
      return argon2.verify(hash, password);
    }
    // Legacy bcrypt ($2a/$2b/$2y).
    return bcrypt.compare(password, hash);
  }

  /** True if the stored hash is not Argon2id and should be re-hashed on next login. */
  needsRehash(hash: string): boolean {
    return !hash.startsWith('$argon2');
  }

  validate(password: string): void {
    const errors: Array<{ field: string; message: string }> = [];

    if (password.length < config.password.minLength) {
      errors.push({
        field: 'password',
        message: `Password must be at least ${config.password.minLength} characters`,
      });
    }

    if (password.length > config.password.maxLength) {
      errors.push({
        field: 'password',
        message: `Password must not exceed ${config.password.maxLength} characters`,
      });
    }

    if (!/[A-Z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/[a-z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!/[0-9]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one number',
      });
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one special character',
      });
    }

    if (errors.length > 0) {
      throw new ValidationError('Password validation failed', errors);
    }
  }

  generateRandomPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + special;

    // Guarantee at least one of each character class
    const chars = [
      uppercase[randomInt(uppercase.length)],
      lowercase[randomInt(lowercase.length)],
      numbers[randomInt(numbers.length)],
      special[randomInt(special.length)],
    ];
    for (let i = chars.length; i < length; i++) {
      chars.push(all[randomInt(all.length)]);
    }

    // Fisher-Yates shuffle using CSPRNG
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}

export const passwordHandler = PasswordHandler.getInstance();
