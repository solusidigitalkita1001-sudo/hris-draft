import express, { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { AppError } from '@/shared/exceptions/AppError';
import { getCurrentCompanyId, getCurrentUser } from '@/shared/context/RequestContext';

jest.mock('@/shared/logger/WinstonLogger', () => ({ WinstonLogger: jest.fn().mockImplementation(() => ({ warn: jest.fn() })) }));
jest.mock('@/shared/middleware/Authenticate', () => ({ authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
  next();
} }));
jest.mock('@/shared/middleware/AuditLog', () => ({ auditLog: () => (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('@/shared/security/employee-data-scope', () => ({ employeeAccessWhere: jest.fn() }));
jest.mock('./ewa.service', () => ({ ewaService: {
  findAll: jest.fn(), findMyRequests: jest.fn(), findById: jest.fn(), getMyLimitServer: jest.fn(), createRequest: jest.fn(),
  approveRequest: jest.fn(), rejectRequest: jest.fn(), cancelRequest: jest.fn(), markPaid: jest.fn(),
} }));
import { ewaService } from './ewa.service';
import router from './ewa.routes';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const COMPANY = '11111111-1111-4111-8111-111111111111', FOREIGN = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333', EMPLOYEE = '44444444-4444-4444-8444-444444444444';
const EWA = '55555555-5555-4555-8555-555555555555';
const BASE = '/api/v1/ewa', service = jest.mocked(ewaService);
function app(options: { authenticated?: boolean; permissions?: string[]; employee?: boolean; companyScope?: string[] } = {}) {
  const instance = express(); instance.use(express.json());
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (options.authenticated !== false) req.user = { id: ACTOR, email: 'ewa@example.test', companyId: COMPANY,
      employeeId: options.employee === false ? undefined : EMPLOYEE, roles: ['GROUP_ADMIN'], companyScope: options.companyScope ?? [COMPANY],
      permissions: options.permissions ?? ['ewa:read', 'ewa:create', 'ewa:update', 'ewa:approve', 'ewa:disburse'] };
    next();
  });
  instance.use(BASE, router);
  instance.use((error: AppError, _req: AuthenticatedRequest, res: Response, _next: NextFunction) => res.status(error.statusCode ?? 500).json({ message: error.message }));
  return instance;
}
describe('EWA HTTP boundary', () => {
  beforeEach(() => jest.resetAllMocks());
  it.each([
    ['get', ''], ['get', '/my'], ['get', '/my/limit'], ['get', `/${EWA}`], ['post', ''], ['post', `/${EWA}/cancel`],
    ['post', `/${EWA}/approve`], ['post', `/${EWA}/reject`], ['post', `/${EWA}/mark-paid`],
  ])('requires authentication and matching permission for %s %s with no-store on errors', async (method, path) => {
    for (const authenticated of [false, true]) {
      const response = await request(app({ authenticated, permissions: ['employee:read'] }))[method](`${BASE}${path}`).send({}).expect(authenticated ? 403 : 401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });
  it('propagates an authorized company switch into the service and rejects an inaccessible company', async () => {
    let company: string | undefined;
    service.findAll.mockImplementationOnce(async () => { company = getCurrentCompanyId(); return []; });
    const response = await request(app({ companyScope: [COMPANY, FOREIGN] })).get(`${BASE}?companyId=${FOREIGN}&employeeId=${EMPLOYEE}&status=PENDING`).expect(200);
    expect(company).toBe(FOREIGN); expect(service.findAll).toHaveBeenCalledWith(FOREIGN, { employeeId: EMPLOYEE, status: 'PENDING' });
    expect(response.headers['cache-control']).toBe('no-store');
    await request(app()).get(`${BASE}?companyId=${FOREIGN}`).expect(403);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
  it('derives self history and limit employee from session and rejects missing employee context', async () => {
    service.findMyRequests.mockResolvedValueOnce([]);
    service.getMyLimitServer.mockResolvedValueOnce({ max: 100 } as never);
    await request(app()).get(`${BASE}/my?employeeId=${ACTOR}&status=APPROVED`).expect(200);
    expect(service.findMyRequests).toHaveBeenCalledWith(EMPLOYEE, 'APPROVED');
    await request(app()).get(`${BASE}/my/limit?employeeId=${ACTOR}&percent=40`).expect(200);
    expect(service.getMyLimitServer).toHaveBeenCalledWith(COMPANY, EMPLOYEE, 40);
    await request(app({ employee: false })).get(`${BASE}/my`).expect(400);
    await request(app({ employee: false })).get(`${BASE}/my/limit`).expect(400);
    expect(service.findMyRequests).toHaveBeenCalledTimes(1); expect(service.getMyLimitServer).toHaveBeenCalledTimes(1);
  });
  it('strips forged actor/status fields while preserving validated create amounts and session context', async () => {
    let actor: string | undefined;
    service.createRequest.mockImplementationOnce(async () => { actor = getCurrentUser()?.id; return { id: EWA } as never; });
    await request(app()).post(BASE).send({ employeeId: EMPLOYEE, amountRequested: '100.25', adminFee: '0', reason: ' School fee ', actorId: 'forged', status: 'PAID' }).expect(201);
    expect(actor).toBe(ACTOR); expect(service.createRequest).toHaveBeenCalledWith({ employeeId: EMPLOYEE, amountRequested: 100.25, adminFee: 0, reason: 'School fee' });
  });
  it.each(['earnedGross', 'periodStart', 'periodEnd'])('rejects client-derived %s before creating EWA', async field => {
    await request(app()).post(BASE).send({ amountRequested: 1, [field]: 'forged' }).expect(422);
    expect(service.createRequest).not.toHaveBeenCalled();
  });
  it.each([0, -1, 'Infinity', 'NaN', 0.001, 10000000000000])('rejects invalid create/payment money %s', async amount => {
    await request(app()).post(BASE).send({ amountRequested: amount }).expect(422);
    await request(app()).post(`${BASE}/${EWA}/mark-paid`).send({ amountPaidOut: amount, disbursementReference: 'BANK' }).expect(422);
    expect(service.createRequest).not.toHaveBeenCalled(); expect(service.markPaid).not.toHaveBeenCalled();
  });
  it('validates UUIDs, rejects structured employee filters, and checks reason/reference lengths', async () => {
    for (const amountRequested of [true, null, [], [1], { amount: 1 }]) await request(app()).post(BASE).send({ amountRequested }).expect(422);
    await request(app()).get(`${BASE}/invalid`).expect(422);
    for (const action of ['approve', 'reject', 'cancel', 'mark-paid']) await request(app()).post(`${BASE}/invalid/${action}`).send({}).expect(422);
    await request(app()).get(`${BASE}?employeeId[not]=${EMPLOYEE}`).expect(422);
    await request(app()).post(BASE).send({ employeeId: 'invalid', amountRequested: 1 }).expect(422);
    await request(app()).post(BASE).send({ payrollPeriodId: 'invalid', amountRequested: 1 }).expect(422);
    await request(app()).post(`${BASE}/${EWA}/reject`).send({ rejectReason: '   ' }).expect(422);
    await request(app()).post(`${BASE}/${EWA}/mark-paid`).send({ amountPaidOut: 1, disbursementReference: 'x'.repeat(101) }).expect(422);
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });
  it.each(['percent=101', 'percent=Infinity', 'percent=0', 'earnedGross=100000'])('rejects invalid limit query %s', async query => {
    await request(app()).get(`${BASE}/my/limit?${query}`).expect(422);
    expect(service.getMyLimitServer).not.toHaveBeenCalled();
  });
  it('passes the session actor to every status transition and trims the payment reference', async () => {
    await request(app()).post(`${BASE}/${EWA}/approve`).send({ approverId: 'forged', approverNotes: ' Approved ' }).expect(200);
    expect(service.approveRequest).toHaveBeenCalledWith(EWA, ACTOR, { approverNotes: 'Approved' });
    await request(app()).post(`${BASE}/${EWA}/reject`).send({ approverId: 'forged', rejectReason: ' Rejected ' }).expect(200);
    expect(service.rejectRequest).toHaveBeenCalledWith(EWA, ACTOR, { rejectReason: 'Rejected' });
    await request(app()).post(`${BASE}/${EWA}/cancel`).send({ cancelledBy: 'forged' }).expect(200);
    expect(service.cancelRequest).toHaveBeenCalledWith(EWA, ACTOR);
    await request(app()).post(`${BASE}/${EWA}/mark-paid`).send({ disburserId: 'forged', amountPaidOut: '100.25', disbursementReference: ' BANK-001 ' }).expect(200);
    expect(service.markPaid).toHaveBeenCalledWith(EWA, ACTOR, { amountPaidOut: 100.25, disbursementReference: 'BANK-001' });
  });
  it('preserves scoped not-found and race conflicts without caching the response', async () => {
    service.findById.mockRejectedValueOnce(new AppError('EWA request tidak ditemukan', 404));
    service.approveRequest.mockRejectedValueOnce(new AppError('EWA status changed', 409));
    const missing = await request(app()).get(`${BASE}/${EWA}`).expect(404);
    const conflict = await request(app()).post(`${BASE}/${EWA}/approve`).send({}).expect(409);
    expect(missing.headers['cache-control']).toBe('no-store'); expect(conflict.headers['cache-control']).toBe('no-store');
  });
});
