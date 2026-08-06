import { z } from 'zod';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaCodeSchema,
} from './auth.dto';

export const validateLogin = loginSchema;
export const validateRefreshToken = refreshTokenSchema;
export const validateChangePassword = changePasswordSchema;
export const validateMfaCode = mfaCodeSchema;
export const validateForgotPassword = forgotPasswordSchema;
export const validateResetPassword = resetPasswordSchema;

export const loginRateLimitSchema = z.object({
  email: z.string().email(),
});
