import crypto from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { runInSystemContext } from '@/shared/context/RequestContext';
import type { RegisterMobileDeviceDTO } from './mobile-device.dto';
import { encryptSecret } from '@/shared/security/secret-crypto';

const publicDeviceSelect = {
  id: true,
  installationId: true,
  platform: true,
  provider: true,
  appVersion: true,
  deviceModel: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class MobileDeviceRepository {
  async register(companyId: string, userId: string, data: RegisterMobileDeviceDTO) {
    const tokenHash = crypto.createHash('sha256').update(data.token, 'utf8').digest('hex');
    const encryptedToken = encryptSecret(data.token);

    // A provider token may only point at one account. This exact-hash cleanup
    // intentionally crosses tenant middleware so an installation that changes
    // account/company cannot continue receiving the previous user's messages.
    // Cleanup and binding are atomic to avoid two concurrent registrations
    // racing the globally unique token hash.
    return runInSystemContext('rebind-mobile-push-token', () => prisma.$transaction(async (tx) => {
      await tx.mobileDeviceRegistration.deleteMany({
        where: {
          tokenHash,
          NOT: { userId, installationId: data.installationId },
        },
      });

      return tx.mobileDeviceRegistration.upsert({
        where: { userId_installationId: { userId, installationId: data.installationId } },
        create: {
          companyId,
          userId,
          installationId: data.installationId,
          platform: data.platform,
          provider: data.provider,
          token: encryptedToken,
          tokenHash,
          appVersion: data.appVersion,
          deviceModel: data.deviceModel,
          isActive: true,
          lastSeenAt: new Date(),
        },
        update: {
          companyId,
          platform: data.platform,
          provider: data.provider,
          token: encryptedToken,
          tokenHash,
          appVersion: data.appVersion,
          deviceModel: data.deviceModel,
          isActive: true,
          lastSeenAt: new Date(),
        },
        select: publicDeviceSelect,
      });
    }));
  }

  unregister(companyId: string, userId: string, installationId: string) {
    return prisma.mobileDeviceRegistration.deleteMany({
      where: { companyId, userId, installationId },
    });
  }
}

export const mobileDeviceRepository = new MobileDeviceRepository();
