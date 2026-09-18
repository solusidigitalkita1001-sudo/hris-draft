import prisma from '@/shared/database/prisma';
import { decryptSecret } from '@/shared/security/secret-crypto';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { logger } from '@/shared/logger/WinstonLogger';
import { sendApns, sendFcm, type PushPayload } from './push-provider';

const MAX_ATTEMPTS = 5;

export type PushSweepResult = {
  notificationsFannedOut: number;
  deliveriesCreated: number;
  deliveriesProcessed: number;
  sent: number;
  invalidTokens: number;
  failed: number;
  blockedConfig: number;
};

export class PushDeliveryService {
  async sweep(): Promise<PushSweepResult> {
    return runInSystemContext('push-delivery-sweep', async () => {
      const result: PushSweepResult = {
        notificationsFannedOut: 0,
        deliveriesCreated: 0,
        deliveriesProcessed: 0,
        sent: 0,
        invalidTokens: 0,
        failed: 0,
        blockedConfig: 0,
      };

      // Only recent inbox notifications are candidates for first delivery.
      // Existing delivery rows retain their own retry lifecycle beyond this window.
      const notifications = await prisma.notification.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
          deliveries: { none: {} },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { id: true, companyId: true, userId: true },
      });

      for (const notification of notifications) {
        const registrations = await prisma.mobileDeviceRegistration.findMany({
          where: {
            companyId: notification.companyId,
            userId: notification.userId,
            isActive: true,
          },
          select: { id: true, provider: true },
        });
        if (!registrations.length) continue;
        const created = await prisma.pushNotificationDelivery.createMany({
          data: registrations.map((registration) => ({
            companyId: notification.companyId,
            userId: notification.userId,
            notificationId: notification.id,
            registrationId: registration.id,
            provider: registration.provider,
          })),
          skipDuplicates: true,
        });
        result.notificationsFannedOut += 1;
        result.deliveriesCreated += created.count;
      }

      const staleProcessing = new Date(Date.now() - 5 * 60_000);
      const deliveries = await prisma.pushNotificationDelivery.findMany({
        where: {
          OR: [
            { status: { in: ['PENDING', 'RETRY', 'BLOCKED_CONFIG'] }, nextAttemptAt: { lte: new Date() } },
            { status: 'PROCESSING', updatedAt: { lt: staleProcessing } },
          ],
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
        take: 100,
        include: {
          notification: true,
          registration: true,
        },
      });

      for (const delivery of deliveries) {
        const claimed = await prisma.pushNotificationDelivery.updateMany({
          where: { id: delivery.id, status: delivery.status, updatedAt: delivery.updatedAt },
          data: { status: 'PROCESSING' },
        });
        if (claimed.count !== 1) continue;
        result.deliveriesProcessed += 1;

        if (!delivery.registration.isActive) {
          await prisma.pushNotificationDelivery.update({
            where: { id: delivery.id },
            data: { status: 'INVALID_TOKEN', lastError: 'Registration is inactive' },
          });
          result.invalidTokens += 1;
          continue;
        }

        const payload: PushPayload = {
          title: delivery.notification.title,
          body: delivery.notification.message,
          notificationId: delivery.notification.id,
          resource: delivery.notification.resource,
          action: delivery.notification.action,
          referenceId: delivery.notification.referenceId,
        };
        let providerResult;
        try {
          const token = decryptSecret(delivery.registration.token);
          providerResult = delivery.provider === 'FCM'
            ? await sendFcm(token, payload)
            : await sendApns(token, payload);
        } catch (error) {
          providerResult = {
            kind: 'retry' as const,
            reason: error instanceof Error ? error.message.slice(0, 500) : 'Push delivery failed',
          };
        }

        if (providerResult.kind === 'sent') {
          await prisma.pushNotificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'SENT',
              attempts: { increment: 1 },
              providerMessageId: providerResult.messageId?.slice(0, 500),
              lastError: null,
              deliveredAt: new Date(),
            },
          });
          result.sent += 1;
          continue;
        }

        if (providerResult.kind === 'invalid-token') {
          await prisma.$transaction([
            prisma.mobileDeviceRegistration.update({
              where: { id: delivery.registrationId },
              data: { isActive: false },
            }),
            prisma.pushNotificationDelivery.update({
              where: { id: delivery.id },
              data: { status: 'INVALID_TOKEN', attempts: { increment: 1 }, lastError: providerResult.reason },
            }),
          ]);
          result.invalidTokens += 1;
          continue;
        }

        if (providerResult.kind === 'config-missing') {
          await prisma.pushNotificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'BLOCKED_CONFIG',
              lastError: providerResult.reason,
              nextAttemptAt: new Date(Date.now() + 5 * 60_000),
            },
          });
          result.blockedConfig += 1;
          continue;
        }

        const attempts = delivery.attempts + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        await prisma.pushNotificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: terminal ? 'FAILED' : 'RETRY',
            attempts,
            lastError: providerResult.reason,
            nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
          },
        });
        if (terminal) result.failed += 1;
      }

      logger.info('Push delivery sweep completed', result);
      return result;
    });
  }
}

export const pushDeliveryService = new PushDeliveryService();
