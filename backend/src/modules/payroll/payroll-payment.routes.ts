import { NextFunction, Response, Router } from 'express';
import { Result } from '@/shared/core/Result';
import { ForbiddenError, ValidationError } from '@/shared/exceptions/AppError';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate } from '@/shared/middleware/RequestValidator';
import {
  createPaymentBatchSchema,
  emptyPaymentActionSchema,
  paymentBatchParamsSchema,
  paymentBatchRunParamsSchema,
  paymentIdempotencyKeySchema,
  paymentTransactionParamsSchema,
  recordPaymentTransactionSchema,
} from './payroll-payment.dto';
import { payrollPaymentService, PayrollPaymentContext } from './payroll-payment.service';

const router = Router();

// Batch previews and bank exports contain payroll data, including raw bank details
// on the export response. Apply this to errors as well as successful responses.
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.use(authenticate);
router.use(requireCompanyAccess());
router.use(authorize({ resource: 'payroll', action: 'process' }));

function paymentContext(req: AuthenticatedRequest): PayrollPaymentContext {
  // requireCompanyAccess sets req.company only after validating access. Do not
  // use company/actor identifiers submitted in request bodies or query strings.
  if (!req.company?.id || !req.user?.id) {
    throw new ForbiddenError('Validated company and actor context is required');
  }
  return { companyId: req.company.id, actorId: req.user.id };
}

function idempotencyKey(req: AuthenticatedRequest): string {
  const parsed = paymentIdempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
  if (!parsed.success) {
    throw new ValidationError('A valid Idempotency-Key header is required', [
      { field: 'Idempotency-Key', message: 'Use 16 to 128 visible ASCII characters without spaces' },
    ]);
  }
  return parsed.data;
}

function respond(operation: (req: AuthenticatedRequest) => Promise<unknown>) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(Result.success(await operation(req)));
    } catch (error) {
      next(error);
    }
  };
}

router.post(
  '/',
  validate(createPaymentBatchSchema),
  respond((req) => payrollPaymentService.createBatch(paymentContext(req), req.body, idempotencyKey(req)))
);

router.get(
  '/run/:runId',
  validate(paymentBatchRunParamsSchema, 'params'),
  respond((req) => payrollPaymentService.getBatchForRun(paymentContext(req), req.params.runId as string))
);

router.get(
  '/:id',
  validate(paymentBatchParamsSchema, 'params'),
  respond((req) => payrollPaymentService.getBatch(paymentContext(req), req.params.id as string))
);

router.post(
  '/:id/export',
  validate(paymentBatchParamsSchema, 'params'),
  validate(emptyPaymentActionSchema),
  respond((req) => payrollPaymentService.exportBatch(paymentContext(req), req.params.id as string))
);

router.patch(
  '/:id/transactions/:transactionId',
  authorize({ resource: 'payroll', action: 'disburse' }),
  validate(paymentTransactionParamsSchema, 'params'),
  validate(recordPaymentTransactionSchema),
  respond((req) => payrollPaymentService.recordTransaction(
    paymentContext(req),
    req.params.id as string,
    req.params.transactionId as string,
    req.body,
    idempotencyKey(req)
  ))
);

router.post(
  '/:id/reconcile',
  authorize({ resource: 'payroll', action: 'disburse' }),
  validate(paymentBatchParamsSchema, 'params'),
  validate(emptyPaymentActionSchema),
  respond((req) => payrollPaymentService.reconcileBatch(
    paymentContext(req), req.params.id as string, idempotencyKey(req)
  ))
);

router.post(
  '/:id/cancel',
  validate(paymentBatchParamsSchema, 'params'),
  validate(emptyPaymentActionSchema),
  respond((req) => payrollPaymentService.cancelBatch(
    paymentContext(req), req.params.id as string, idempotencyKey(req)
  ))
);

export default router;
