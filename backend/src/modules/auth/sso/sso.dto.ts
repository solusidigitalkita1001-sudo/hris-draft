import { z } from 'zod';

export const registerSsoProviderSchema = z.object({
  name: z.string().min(1).max(150),
  /// OIDC issuer, e.g. https://accounts.google.com — discovery runs against it
  /// before the provider is stored, so a typo fails here and not at an
  /// employee's first login attempt.
  issuer: z.string().url().max(300),
  clientId: z.string().min(1).max(300),
  clientSecret: z.string().min(1).max(500),
  /// Bare domains, e.g. ["company.com"]. Empty means any domain the provider
  /// returns is accepted.
  allowedDomains: z.array(z.string().min(3).max(253)).max(50).optional(),
  /// Off unless explicitly asked for: an identity provider proving who someone
  /// is must not decide they should have an HRIS account.
  autoProvision: z.boolean().optional(),
});

export const updateSsoProviderSchema = z
  .object({
    isActive: z.boolean().optional(),
    allowedDomains: z.array(z.string().min(3).max(253)).max(50).optional(),
    autoProvision: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const ssoStartQuerySchema = z.object({
  /// Company code, so an employee can be sent straight to their own provider.
  company: z.string().min(1).max(50),
  /// Relative path only; absolute URLs are dropped rather than followed.
  returnTo: z.string().max(300).optional(),
});

export const ssoCallbackQuerySchema = z.object({
  state: z.string().min(1).max(100),
  code: z.string().min(1).max(2000).optional(),
  error: z.string().max(200).optional(),
  error_description: z.string().max(500).optional(),
});

export type RegisterSsoProviderDTO = z.infer<typeof registerSsoProviderSchema>;
export type UpdateSsoProviderDTO = z.infer<typeof updateSsoProviderSchema>;
export type SsoStartQueryDTO = z.infer<typeof ssoStartQuerySchema>;
export type SsoCallbackQueryDTO = z.infer<typeof ssoCallbackQuerySchema>;
