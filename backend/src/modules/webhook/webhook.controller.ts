import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { webhookService } from './webhook.service';
import { WEBHOOK_EVENTS } from './webhook-events';
import type { CreateWebhookDTO, UpdateWebhookDTO, WebhookDeliveryQueryDTO } from './webhook.dto';

function activeCompany(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class WebhookController {
  /** The catalogue an integrator builds against. */
  async events(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success({ events: WEBHOOK_EVENTS }));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { subscription, secret } = await webhookService.create(activeCompany(req), req.body as CreateWebhookDTO);
      res.status(201).json(
        Result.success(
          {
            id: subscription.id,
            url: subscription.url,
            events: subscription.events,
            isActive: subscription.isActive,
            secret,
          },
          'Simpan secret ini sekarang — ia tidak bisa dibaca kembali. Pakai untuk memverifikasi header X-HRIS-Signature.',
        ),
      );
    } catch (error) { next(error); }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await webhookService.list(activeCompany(req))));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(
        await webhookService.update(activeCompany(req), String(req.params.id), req.body as UpdateWebhookDTO),
      ));
    } catch (error) { next(error); }
  }

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await webhookService.remove(activeCompany(req), String(req.params.id))));
    } catch (error) { next(error); }
  }

  /** Delivery log: what was sent, what came back, how many attempts. */
  async deliveries(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as WebhookDeliveryQueryDTO;
      res.json(Result.success(await webhookService.deliveries(activeCompany(req), query)));
    } catch (error) { next(error); }
  }
}

export const webhookController = new WebhookController();
