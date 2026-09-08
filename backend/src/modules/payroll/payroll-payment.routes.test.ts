import express, { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { AppError } from '@/shared/exceptions/AppError';

jest.mock('@/config', () => ({ __esModule: true, default: { app: { apiPrefix: '/api/v1' } } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({
  WinstonLogger: jest.fn().mockImplementation(() => ({ warn: jest.fn() })),
}));

jest.mock('@/shared/middleware/Authenticate', () => ({
  authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
    next();
  },
}));

jest.mock('./payroll-payment.service', () => ({
  payrollPaymentService: {
    createBatch: jest.fn(), getBatch: jest.fn(), getBatchForRun: jest.fn(), exportBatch: jest.fn(),
    recordTransaction: jest.fn(), reconcileBatch: jest.fn(), cancelBatch: jest.fn(),
  },
}));

import router from './payroll-payment.routes';
import { payrollPaymentService } from './payroll-payment.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const service = jest.mocked(payrollPaymentService);
const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';
const RUN = '44444444-4444-4444-8444-444444444444';
const BATCH = '55555555-5555-4555-8555-555555555555';
const TRANSACTION = '66666666-6666-4666-8666-666666666666';
const KEY = 'request-key-0001';
const BASE = '/api/v1/payroll/payment-batches';
const context = { companyId: COMPANY_A, actorId: ACTOR };

function app(options: { authenticated?: boolean; permissions?: string[] } = {}) {
  const instance = express();
  instance.use(express.json());
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (options.authenticated !== false) {
      req.user = {
        id: ACTOR, email: 'payroll@example.test', companyId: COMPANY_A,
        companyScope: [COMPANY_A], roles: ['GROUP_ADMIN'],
        permissions: options.permissions ?? ['payroll:process', 'payroll:disburse'],
      };
    }
    next();
  });
  instance.use(BASE, router);
  instance.use((error: AppError, _req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    res.status(error.statusCode ?? 500).json({ message: error.message });
  });
  return instance;
}

describe('payroll payment HTTP boundary', () => {
  beforeEach(() => jest.resetAllMocks());

  it.each(['record', 'reconcile'])('requires payroll:disburse in addition to process for %s', async action => {
    const client = request(app({ permissions: ['payroll:process'] }));
    const response = action === 'record'
      ? client.patch(`${BASE}/${BATCH}/transactions/${TRANSACTION}`)
      : client.post(`${BASE}/${BATCH}/reconcile`);
    await response.set('Idempotency-Key', KEY).send({ status: 'PAID', amount: '100.25', bankReference: 'BANK-001' }).expect(403);
    expect(service.recordTransaction).not.toHaveBeenCalled();
    expect(service.reconcileBatch).not.toHaveBeenCalled();
  });

  it('creates using the validated company and authenticated actor, strips actor forgery, and uses a replay-stable envelope', async () => {
    service.createBatch.mockResolvedValue({ id: BATCH } as never);
    const response = await request(app()).post(BASE).set('Idempotency-Key', KEY)
      .send({ runId: RUN, actorId: 'forged', createdBy: 'forged', status: 'RECONCILED' }).expect(200);

    expect(service.createBatch).toHaveBeenCalledWith(context, { runId: RUN }, KEY);
    expect(response.body).toEqual({ success: true, message: 'Success', data: { id: BATCH } });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each(['body', 'query'])('rejects an inaccessible company supplied in %s', async (source) => {
    const path = source === 'query' ? `${BASE}?companyId=${COMPANY_B}` : BASE;
    const body = source === 'body' ? { runId: RUN, companyId: COMPANY_B } : { runId: RUN };
    const response = await request(app()).post(path).set('Idempotency-Key', KEY).send(body).expect(403);
    expect(service.createBatch).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['post', '', { runId: RUN }],
    ['patch', `/${BATCH}/transactions/${TRANSACTION}`, { status: 'FAILED', failureReason: 'Rejected' }],
    ['post', `/${BATCH}/reconcile`, {}],
    ['post', `/${BATCH}/cancel`, {}],
  ])('requires an idempotency key for %s %s', async (method, path, body) => {
    const response = await request(app())[method as string](`${BASE}${path}`).send(body).expect(422);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.createBatch).not.toHaveBeenCalled();
    expect(service.recordTransaction).not.toHaveBeenCalled();
    expect(service.reconcileBatch).not.toHaveBeenCalled();
    expect(service.cancelBatch).not.toHaveBeenCalled();
  });

  it('rejects an invalid key before calling the service', async () => {
    await request(app()).post(BASE).set('Idempotency-Key', 'short').send({ runId: RUN }).expect(422);
    expect(service.createBatch).not.toHaveBeenCalled();
  });

  it('gets and exports batch data without requiring an idempotency key', async () => {
    service.getBatch.mockResolvedValue({ id: BATCH } as never);
    service.exportBatch.mockResolvedValue({ csv: 'bank,account' } as never);
    const preview = await request(app()).get(`${BASE}/${BATCH}`).expect(200);
    const exported = await request(app()).post(`${BASE}/${BATCH}/export`).send({ bankAccountNumber: 'forged' }).expect(200);
    expect(service.getBatch).toHaveBeenCalledWith(context, BATCH);
    expect(service.exportBatch).toHaveBeenCalledWith(context, BATCH);
    expect(preview.headers['cache-control']).toBe('no-store');
    expect(exported.headers['cache-control']).toBe('no-store');
  });

  it('records a validated decimal payment and trims the bank reference', async () => {
    service.recordTransaction.mockResolvedValue({ id: BATCH } as never);
    await request(app()).patch(`${BASE}/${BATCH}/transactions/${TRANSACTION}`).set('Idempotency-Key', KEY)
      .send({ status: 'PAID', amount: '100.25', bankReference: '  BANK-001  ', actorId: 'forged' }).expect(200);
    expect(service.recordTransaction).toHaveBeenCalledWith(context, BATCH, TRANSACTION, {
      status: 'PAID', amount: '100.25', bankReference: 'BANK-001',
    }, KEY);
  });

  it('looks up the existing batch for a run and preserves an empty result', async () => {
    service.getBatchForRun.mockResolvedValue(null);
    const response = await request(app()).get(`${BASE}/run/${RUN}`).expect(200);
    expect(service.getBatchForRun).toHaveBeenCalledWith(context, RUN);
    expect(response.body).toEqual({ success: true, message: 'Success', data: null });
    expect(response.headers['cache-control']).toBe('no-store');
    await request(app()).get(`${BASE}/run/invalid`).expect(422);
    expect(service.getBatchForRun).toHaveBeenCalledTimes(1);
  });

  it.each(['reconcile', 'cancel'])('passes validated context and key to %s, ignoring body metadata', async (action) => {
    await request(app()).post(`${BASE}/${BATCH}/${action}`).set('Idempotency-Key', KEY)
      .send({ actorId: 'forged', status: 'RECONCILED' }).expect(200);
    const method = action === 'reconcile' ? service.reconcileBatch : service.cancelBatch;
    expect(method).toHaveBeenCalledWith(context, BATCH, KEY);
  });

  it('validates batch and transaction path IDs', async () => {
    await request(app()).get(`${BASE}/invalid`).expect(422);
    await request(app()).patch(`${BASE}/${BATCH}/transactions/invalid`).set('Idempotency-Key', KEY)
      .send({ status: 'FAILED', failureReason: 'Rejected' }).expect(422);
    expect(service.getBatch).not.toHaveBeenCalled();
    expect(service.recordTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['get', `/${BATCH}`], ['get', `/run/${RUN}`], ['post', ''], ['post', `/${BATCH}/export`],
    ['patch', `/${BATCH}/transactions/${TRANSACTION}`],
    ['post', `/${BATCH}/reconcile`], ['post', `/${BATCH}/cancel`],
  ])('requires payroll:process on %s %s', async (method, path) => {
    const response = await request(app({ permissions: ['payroll:read'] }))[method](`${BASE}${path}`).expect(403);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('requires authentication and prevents caching authentication failures', async () => {
    const response = await request(app({ authenticated: false })).get(`${BASE}/${BATCH}`).expect(401);
    expect(service.getBatch).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('forwards async service failures with no-store still set', async () => {
    service.getBatch.mockRejectedValue(new AppError('Batch missing', 404));
    const response = await request(app()).get(`${BASE}/${BATCH}`).expect(404);
    expect(response.body.message).toBe('Batch missing');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
