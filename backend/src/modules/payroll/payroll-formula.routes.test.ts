import express, { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { AppError } from '@/shared/exceptions/AppError';
jest.mock('@/shared/logger/WinstonLogger', () => ({ WinstonLogger: jest.fn().mockImplementation(() => ({ warn: jest.fn() })), logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/shared/middleware/Authenticate', () => ({ authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 })); next();
} }));
jest.mock('./payroll-formula.service', () => ({ payrollFormulaService: { list: jest.fn(), createDraft: jest.fn(), preview: jest.fn(), publish: jest.fn() } }));
import router from './payroll-formula.routes';
import { payrollFormulaService } from './payroll-formula.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const service = jest.mocked(payrollFormulaService);
const COMPANY = '11111111-1111-4111-8111-111111111111', FOREIGN = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333', COMPONENT = '44444444-4444-4444-8444-444444444444', VERSION = '55555555-5555-4555-8555-555555555555';
const BASE = `/api/v1/payroll/formulas/${COMPONENT}/versions`, PREVIEW = `${BASE}/${VERSION}/preview`;
const input = { inputs: { BASE_SALARY: '1000.10', WORK_DAYS: '20', PRESENT_DAYS: '19', LEAVE_DAYS: '0.5', ABSENT_DAYS: '0.5', OVERTIME_HOURS: '0' } };
function app(permissions = ['payroll:read', 'payroll:update', 'payroll:approve'], authenticated = true) {
  const instance = express(); instance.use(express.json());
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (authenticated) req.user = { id: ACTOR, email: 'formula@example.test', companyId: COMPANY, companyScope: [COMPANY], roles: ['GROUP_ADMIN'], permissions };
    next();
  });
  instance.use('/api/v1/payroll/formulas', router);
  instance.use((error: AppError, _req: AuthenticatedRequest, res: Response, _next: NextFunction) => res.status(error.statusCode ?? 500).json({ message: error.message }));
  return instance;
}
describe('formula HTTP company, actor and permission boundary', () => {
  beforeEach(() => jest.resetAllMocks());
  it.each(['payroll:update', 'payroll:approve', 'payroll:*'])('allows simulation with %s', async permission => {
    await request(app([permission])).post(PREVIEW).send(input).expect(200);
    expect(service.preview).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY, actorId: ACTOR }), COMPONENT, VERSION, { ...input, componentAmounts: {} });
  });
  it('keeps creation, publication and read-only permissions distinct', async () => {
    await request(app(['payroll:approve'])).post(BASE).send({ expression: '1', effectiveFrom: '2026-10-01' }).expect(403);
    await request(app(['payroll:update'])).post(`${BASE}/${VERSION}/publish`).expect(403);
    await request(app(['payroll:read'])).post(PREVIEW).send(input).expect(403);
    await request(app(['payroll:read'])).get(BASE).expect(200);
    expect(service.createDraft).not.toHaveBeenCalled(); expect(service.publish).not.toHaveBeenCalled(); expect(service.preview).not.toHaveBeenCalled();
  });
  it('uses only the authenticated actor and validated company, discarding forged revision state', async () => {
    const response = await request(app()).post(BASE).send({ expression: '  BASE_SALARY / 10  ', effectiveFrom: '2026-10-01', actorId: FOREIGN, createdBy: FOREIGN, status: 'PUBLISHED', version: 999 }).expect(200);
    expect(service.createDraft).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY, actorId: ACTOR }), COMPONENT, { expression: 'BASE_SALARY / 10', effectiveFrom: '2026-10-01' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each(['body', 'query'])('rejects foreign company in %s', async source => {
    await request(app()).post(source === 'query' ? `${PREVIEW}?companyId=${FOREIGN}` : PREVIEW)
      .send(source === 'body' ? { ...input, companyId: FOREIGN } : input).expect(403);
    expect(service.preview).not.toHaveBeenCalled();
  });
  it('rejects invalid dates, fractional whole-day inputs, unknown inputs and invalid IDs', async () => {
    await request(app()).post(BASE).send({ expression: '1', effectiveFrom: '2026-02-30' }).expect(422);
    await request(app()).post(PREVIEW).send({ inputs: { ...input.inputs, WORK_DAYS: '1.5' } }).expect(422);
    await request(app()).post(PREVIEW).send({ inputs: { ...input.inputs, SECRET: '1' } }).expect(422);
    await request(app()).post(PREVIEW.replace(VERSION, 'invalid')).send(input).expect(422);
    expect(service.createDraft).not.toHaveBeenCalled(); expect(service.preview).not.toHaveBeenCalled();
  });
  it('does not expose a revision-edit endpoint and forwards publication actor from session', async () => {
    await request(app()).patch(`${BASE}/${VERSION}`).send({ expression: '999' }).expect(404);
    await request(app()).post(`${BASE}/${VERSION}/publish`).send({ actorId: FOREIGN, publishedBy: FOREIGN }).expect(200);
    expect(service.publish).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY, actorId: ACTOR }), COMPONENT, VERSION);
  });
  it('prevents caching authentication and service failures', async () => {
    expect((await request(app([], false)).get(BASE).expect(401)).headers['cache-control']).toBe('no-store');
    service.list.mockRejectedValue(new AppError('Missing version', 404));
    expect((await request(app()).get(BASE).expect(404)).headers['cache-control']).toBe('no-store');
  });
});
