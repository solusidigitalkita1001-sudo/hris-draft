import bcrypt from 'bcryptjs';
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

  async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(config.password.saltRounds);
    return bcrypt.hash(password, salt);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
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
    let password = '';

    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}

export const passwordHandler = PasswordHandler.getInstance();
