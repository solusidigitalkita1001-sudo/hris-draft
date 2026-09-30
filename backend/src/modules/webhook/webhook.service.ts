import crypto from 'node:crypto';
import { WebhookDeliveryStatus, Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser, runInSystemContext } from '@/shared/context/RequestContext';
import { encryptSecret, decryptSecret } from '@/shared/security/secret-crypto';
import type { DomainEvent } from '@/shared/events/EventBus';
import { WEBHOOK_EVENTS } from './webhook-events';
import { assertDeliverableUrl, assertResolvesPublicly } from './webhook-url-guard';

/** Give up after this many attempts; the delivery becomes DEAD, not retried forever. */
const MAX_ATTEMPTS = 6;
/** Consecutive failures after which a subscription switches itself off. */
const FAILURE_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 10_000;
/** Exponential-ish backoff in seconds, indexed by attempt count. */
const BACKOFF_SECONDS = [30, 120, 600, 3_600, 21_600];

export interface CreateSubscriptionInput {
  url: string;
  events: string[];
  description?: string;
}

export interface WebhookSweepResult {
  due: number;
  sent: number;
  retrying: number;
  dead: number;
  subscriptionsDisabled: number;
}

function backoffFor(attempts: number): Date {
  const seconds = BACKOFF_SECONDS[Math.min(attempts, BACKOFF_SECONDS.length - 1)];
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Sign the exact bytes that are sent, with the timestamp inside the signed
 * material. Signing the body alone would let anyone replay a captured payload
 * forever; including the timestamp lets a receiver reject anything stale.
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export class WebhookService {
  async create(companyId: string, input: CreateSubscriptionInput) {
    assertDeliverableUrl(input.url);

    const unknown = input.events.filter((name) => !WEBHOOK_EVENTS.includes(name));
    if (unknown.length) {
      throw new BadRequestError(`Unknown event name(s): ${unknown.join(', ')}. See GET /webhooks/events.`);
    }

    // Shown once. Stored encrypted rather than hashed because signing needs the
    // secret itself — a hash cannot produce an HMAC.
    const secret = crypto.randomBytes(32).toString('base64url');
    const subscription = await prisma.webhookSubscription.create({
      data: {
        companyId,
        url: input.url,
        events: [...new Set(input.events)] as Prisma.InputJsonValue,
        secretCipher: encryptSecret(secret),
        description: input.description,
        createdBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('Webhook subscription created', { id: subscription.id, companyId, url: input.url });
    return { subscription, secret };
  }

  async list(companyId: string) {
    return prisma.webhookSubscription.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      // secretCipher is deliberately absent: nothing reads the secret back out
      // through the API, not even in encrypted form.
      select: {
        id: true, url: true, events: true, description: true, isActive: true,
        failureCount: true, disabledReason: true, lastDeliveryAt: true, createdAt: true,
      },
    });
  }

  async update(companyId: string, id: string, patch: { events?: string[]; isActive?: boolean; description?: string }) {
    const subscription = await prisma.webhookSubscription.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!subscription) throw new NotFoundError('Webhook subscription not found');

    if (patch.events) {
      const unknown = patch.events.filter((name) => !WEBHOOK_EVENTS.includes(name));
      if (unknown.length) throw new BadRequestError(`Unknown event name(s): ${unknown.join(', ')}`);
    }

    return prisma.webhookSubscription.update({
      where: { id: subscription.id },
      data: {
        ...(patch.events ? { events: [...new Set(patch.events)] as Prisma.InputJsonValue } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        // Re-enabling clears the counter and the reason, or the subscription
        // would switch itself off again on the next single failure.
        ...(patch.isActive !== undefined
          ? patch.isActive
            ? { isActive: true, failureCount: 0, disabledReason: null }
            : { isActive: false, disabledReason: 'Disabled by an administrator' }
          : {}),
      },
      select: { id: true, url: true, events: true, isActive: true, failureCount: true, disabledReason: true },
    });
  }

  async remove(companyId: string, id: string) {
    const subscription = await prisma.webhookSubscription.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!subscription) throw new NotFoundError('Webhook subscription not found');
    await prisma.webhookSubscription.update({
      where: { id: subscription.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id, deleted: true };
  }

  async deliveries(companyId: string, filters: { subscriptionId?: string; status?: WebhookDeliveryStatus; limit: number }) {
    return prisma.webhookDelivery.findMany({
      where: {
        companyId,
        ...(filters.subscriptionId ? { subscriptionId: filters.subscriptionId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    });
  }

  /**
   * Turn one domain event into pending deliveries for the subscriptions that
   * asked for it.
   *
   * Queue-level dedupe exists, but this adds its own: the unique
   * (subscriptionId, eventId) pair means a re-delivered event cannot become two
   * calls into a customer's system, which for them may mean two invoices.
   */
  async fanOut(event: DomainEvent): Promise<number> {
    const companyId = typeof event.data?.companyId === 'string' ? event.data.companyId : null;
    if (!companyId || !WEBHOOK_EVENTS.includes(event.name)) return 0;

    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: { id: true, events: true },
    });

    const interested = subscriptions.filter((subscription) =>
      Array.isArray(subscription.events) && (subscription.events as string[]).includes(event.name));
    if (!interested.length) return 0;

    const payload = {
      id: event.metadata.eventId,
      event: event.name,
      occurredAt: event.metadata.occurredAt,
      aggregate: { id: event.aggregateId, type: event.aggregateType },
      data: event.data,
    } as Prisma.InputJsonValue;

    const created = await prisma.webhookDelivery.createMany({
      data: interested.map((subscription) => ({
        companyId,
        subscriptionId: subscription.id,
        eventId: event.metadata.eventId,
        eventName: event.name,
        payload,
        nextAttemptAt: new Date(),
      })),
      skipDuplicates: true,
    });

    if (created.count) logger.debug('Webhook deliveries queued', { event: event.name, count: created.count });
    return created.count;
  }

  /**
   * Send everything that is due.
   *
   * Runs in system context because it serves every tenant at once: the sweep
   * has no session, and each delivery already carries the company it belongs
   * to. Failures never throw out of here — one unreachable customer endpoint
   * must not stop the others being served.
   */
  async sweep(now = new Date()): Promise<WebhookSweepResult> {
    return runInSystemContext('webhook-delivery-sweep', async () => {
      const result: WebhookSweepResult = { due: 0, sent: 0, retrying: 0, dead: 0, subscriptionsDisabled: 0 };

      const due = await prisma.webhookDelivery.findMany({
        where: {
          status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED] },
          nextAttemptAt: { lte: now },
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: 100,
        include: { subscription: { select: { id: true, url: true, secretCipher: true, isActive: true, failureCount: true, deletedAt: true } } },
      });
      result.due = due.length;

      for (const delivery of due) {
        const subscription = delivery.subscription;
        if (!subscription.isActive || subscription.deletedAt) {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: { status: WebhookDeliveryStatus.DEAD, lastError: 'Subscription is inactive' },
          });
          result.dead++;
          continue;
        }

        const attempts = delivery.attempts + 1;
        try {
          const url = assertDeliverableUrl(subscription.url);
          await assertResolvesPublicly(url.hostname);

          const body = JSON.stringify(delivery.payload);
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const signature = signPayload(decryptSecret(subscription.secretCipher), timestamp, body);

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'user-agent': 'HRIS-Webhook/1',
              'x-hris-event': delivery.eventName,
              'x-hris-delivery': delivery.id,
              'x-hris-timestamp': timestamp,
              'x-hris-signature': `sha256=${signature}`,
            },
            body,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            redirect: 'manual', // a redirect could lead somewhere private
          });

          if (response.status >= 200 && response.status < 300) {
            await prisma.$transaction([
              prisma.webhookDelivery.update({
                where: { id: delivery.id },
                data: {
                  status: WebhookDeliveryStatus.SENT, attempts, responseStatus: response.status,
                  sentAt: new Date(), nextAttemptAt: null, lastError: null,
                },
              }),
              prisma.webhookSubscription.update({
                where: { id: subscription.id },
                data: { failureCount: 0, lastDeliveryAt: new Date() },
              }),
            ]);
            result.sent++;
            continue;
          }

          await this.recordFailure(delivery.id, subscription.id, attempts, `HTTP ${response.status}`, response.status, result);
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed';
          await this.recordFailure(delivery.id, subscription.id, attempts, message, null, result);
        }
      }

      if (result.due) logger.info('Webhook sweep finished', { ...result });
      return result;
    });
  }

  private async recordFailure(
    deliveryId: string,
    subscriptionId: string,
    attempts: number,
    message: string,
    responseStatus: number | null,
    result: WebhookSweepResult,
  ) {
    const exhausted = attempts >= MAX_ATTEMPTS;
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: exhausted ? WebhookDeliveryStatus.DEAD : WebhookDeliveryStatus.FAILED,
        attempts,
        responseStatus,
        lastError: message,
        nextAttemptAt: exhausted ? null : backoffFor(attempts),
      },
    });
    if (exhausted) result.dead++;
    else result.retrying++;

    const subscription = await prisma.webhookSubscription.update({
      where: { id: subscriptionId },
      data: { failureCount: { increment: 1 } },
      select: { failureCount: true, isActive: true },
    });

    // An endpoint that has failed this many times in a row is gone, not busy.
    // Knocking forever wastes the sweep on a door nobody will answer, so it
    // switches itself off and says why — an administrator re-enables it.
    if (subscription.isActive && subscription.failureCount >= FAILURE_LIMIT) {
      await prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: {
          isActive: false,
          disabledReason: `Disabled automatically after ${subscription.failureCount} consecutive failures: ${message}`.slice(0, 255),
        },
      });
      result.subscriptionsDisabled++;
      logger.warn('Webhook subscription disabled after repeated failures', { subscriptionId, failures: subscription.failureCount });
    }
  }
}

export const webhookService = new WebhookService();
