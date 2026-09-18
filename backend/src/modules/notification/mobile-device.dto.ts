import { z } from 'zod';

export const registerMobileDeviceSchema = z.object({
  installationId: z.string().trim().min(8).max(200),
  platform: z.enum(['ANDROID', 'IOS']),
  provider: z.enum(['FCM', 'APNS']),
  token: z.string().trim().min(20).max(4096),
  appVersion: z.string().trim().max(50).optional(),
  deviceModel: z.string().trim().max(100).optional(),
}).refine((value) => value.provider !== 'APNS' || value.platform === 'IOS', {
  message: 'APNS hanya dapat dipakai oleh platform IOS',
  path: ['provider'],
});

export const unregisterMobileDeviceSchema = z.object({
  installationId: z.string().trim().min(8).max(200),
});

export type RegisterMobileDeviceDTO = z.infer<typeof registerMobileDeviceSchema>;
