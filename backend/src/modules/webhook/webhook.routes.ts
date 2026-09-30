import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { webhookController } from './webhook.controller';
import { createWebhookSchema, updateWebhookSchema, webhookDeliveryQuerySchema } from './webhook.dto';

const router = Router();

router.use(authenticate);
router.use(requireCompanyAccess());

// A subscription decides where this company's business facts are sent, which is
// an integration-administration power rather than an HR one — hence rbac.
router.get('/events', authorize({ resource: 'rbac', action: 'read' }), webhookController.events.bind(webhookController));
router.get(
  '/deliveries',
  authorize({ resource: 'rbac', action: 'read' }),
  validate(webhookDeliveryQuerySchema, 'query'),
  webhookController.deliveries.bind(webhookController),
);
router.get('/', authorize({ resource: 'rbac', action: 'read' }), webhookController.list.bind(webhookController));
router.post(
  '/',
  authorize({ resource: 'rbac', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'WebhookSubscription' }),
  validate(createWebhookSchema),
  webhookController.create.bind(webhookController),
);
router.patch(
  '/:id',
  authorize({ resource: 'rbac', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'WebhookSubscription', model: 'webhookSubscription' }),
  validate(updateWebhookSchema),
  webhookController.update.bind(webhookController),
);
router.delete(
  '/:id',
  authorize({ resource: 'rbac', action: 'delete' }),
  auditLog({ action: 'DELETE', entity: 'WebhookSubscription', model: 'webhookSubscription' }),
  webhookController.remove.bind(webhookController),
);

export default router;
