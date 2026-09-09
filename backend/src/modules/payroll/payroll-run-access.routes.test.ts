import express, { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { AppError } from '@/shared/exceptions/AppError';
import { getCurrentCompanyId, getCurrentUser } from '@/shared/context/RequestContext';

jest.mock('@/config', () => ({ __esModule: true, default: { app: { apiPrefix: '/api/v1' } } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ WinstonLogger: jest.fn().mockImplementation(() => ({ warn: jest.fn() })) }));
jest.mock('@/shared/middleware/Authenticate', () => ({ authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
  next();
} }));
jest.mock('@/shared/middleware/AuditLog', () => ({ auditLog: () => (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('./payroll-payment.routes', () => ({ __esModule: true, default: (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('./payroll-formula.routes', () => ({ __esModule: true, default: (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('@/shared/security/employee-data-scope', () => ({ employeeAccessWhere: jest.fn() }));
jest.mock('./payroll.service', () => ({ payrollService: {
  findAllPayrollRuns: jest.fn(), findPayrollRunById: jest.fn(), createPayrollRun: jest.fn(), approvePayrollRun: jest.fn(), disbursePayrollRun: jest.fn(), getPayrollRunDisbursements: jest.fn(),
  findAllPayrollPeriods: jest.fn(), findPayrollPeriodById: jest.fn(), getAttendanceSummaryForPeriod: jest.fn(), confirmAttendanceReview: jest.fn(),
  createPayrollPeriod: jest.fn(), updatePayrollPeriod: jest.fn(), closePayrollPeriod: jest.fn(), findPayslipById: jest.fn(), findPayslipsByEmployee: jest.fn(),
} }));
import { employeeAccessWhere } from '@/shared/security/employee-data-scope';
import { payrollService } from './payroll.service';
import router from './payroll.routes';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const COMPANY = '11111111-1111-4111-8111-111111111111', FOREIGN = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333', EMPLOYEE = '44444444-4444-4444-8444-444444444444';
const RUN = '55555555-5555-4555-8555-555555555555', PERIOD = '66666666-6666-4666-8666-666666666666', SLIP = '77777777-7777-4777-8777-777777777777';
const BASE = '/api/v1/payroll';
const service = jest.mocked(payrollService);
function app(options: { authenticated?: boolean; permissions?: string[]; employeeId?: string | null; companyScope?: string[] } = {}) {
  const instance = express(); instance.use(express.json());
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (options.authenticated !== false) req.user = { id: ACTOR, email: 'payroll@example.test', companyId: COMPANY,
      employeeId: options.employeeId === undefined ? EMPLOYEE : options.employeeId ?? undefined,
      companyScope: options.companyScope ?? [COMPANY], roles: ['GROUP_ADMIN'],
      permissions: options.permissions ?? ['payroll:read', 'payroll:process', 'payroll:approve', 'payroll:update', 'payroll:create', 'payroll:disburse'] };
    next();
  });
  instance.use(BASE, router);
  instance.use((error: AppError, _req: AuthenticatedRequest, res: Response, _next: NextFunction) => res.status(error.statusCode ?? 500).json({ message: error.message }));
  return instance;
}
describe('payroll run and payslip HTTP boundary', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(employeeAccessWhere).mockImplementation(async () => ({ companyId: getCurrentCompanyId() }));
  });
  it('passes an authorized company switch into scope resolution and run queries', async () => {
    let company: string | undefined;
    service.findAllPayrollRuns.mockImplementationOnce(async () => { company = getCurrentCompanyId(); return []; });
    const response = await request(app({ companyScope: [COMPANY, FOREIGN] })).get(`${BASE}/runs?companyId=${FOREIGN}&employeeId=${EMPLOYEE}&branchId=forged`).expect(200);
    expect(company).toBe(FOREIGN); expect(employeeAccessWhere).toHaveBeenCalledWith('payroll');
    expect(service.findAllPayrollRuns).toHaveBeenCalledWith(FOREIGN); expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each([
    ['get', '/runs'], ['get', `/runs/${RUN}`], ['post', '/runs'], ['patch', `/runs/${RUN}/approve`], ['patch', `/runs/${RUN}/disburse`], ['get', `/runs/${RUN}/disbursements`],
    ['get', '/periods'], ['get', `/periods/${PERIOD}`], ['post', '/periods'], ['patch', `/periods/${PERIOD}`], ['patch', `/periods/${PERIOD}/close`],
    ['get', `/periods/${PERIOD}/attendance-summary`], ['put', `/periods/${PERIOD}/confirm-attendance`],
  ])('denies employee-scoped %s %s before any payroll service call', async (method, path) => {
    jest.mocked(employeeAccessWhere).mockImplementation(async () => ({ companyId: getCurrentCompanyId(), id: EMPLOYEE }));
    const response = await request(app())[method](`${BASE}${path}`).send({ companyId: COMPANY, periodId: PERIOD, name: 'Forged' }).expect(403);
    expect(response.headers['cache-control']).toBe('no-store');
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });
  it.each([`/runs/${RUN}`, `/periods/${PERIOD}`, `/payslips/${SLIP}`, '/payslips'])('requires authentication and read permission on %s with no-store on errors', async path => {
    for (const authenticated of [false, true]) {
      const response = await request(app({ authenticated, permissions: ['employee:read'] })).get(`${BASE}${path}`).expect(authenticated ? 403 : 401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });
  it('keeps self-service employee identity in the session even when employee query fields are forged', async () => {
    service.findPayslipsByEmployee.mockResolvedValueOnce([]);
    const response = await request(app()).get(`${BASE}/payslips?employeeId=${ACTOR}`).expect(200);
    expect(service.findPayslipsByEmployee).toHaveBeenCalledWith(EMPLOYEE); expect(response.headers['cache-control']).toBe('no-store');
    await request(app({ employeeId: null })).get(`${BASE}/payslips?employeeId=${EMPLOYEE}`).expect(400);
    expect(service.findPayslipsByEmployee).toHaveBeenCalledTimes(1);
  });
  it('validates run, slip and attendance IDs and preserves scoped not-found errors', async () => {
    for (const path of ['/runs/invalid', '/payslips/invalid', '/periods/invalid/attendance-summary']) await request(app()).get(`${BASE}${path}`).expect(422);
    await request(app()).put(`${BASE}/periods/invalid/confirm-attendance`).send({}).expect(422);
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
    service.findPayslipById.mockRejectedValueOnce(new AppError('Payslip not found', 404));
    const response = await request(app()).get(`${BASE}/payslips/${SLIP}`).expect(404);
    expect(response.body.message).toBe('Payslip not found'); expect(response.headers['cache-control']).toBe('no-store');
  });
  it('rejects inaccessible companies and scope lookup failures before reads', async () => {
    await request(app()).get(`${BASE}/runs?companyId=${FOREIGN}`).expect(403);
    jest.mocked(employeeAccessWhere).mockRejectedValueOnce(new Error('Scope unavailable'));
    await request(app()).get(`${BASE}/runs`).expect(500);
    expect(service.findAllPayrollRuns).not.toHaveBeenCalled();
  });
  it('passes the session actor for run creation, approval and attendance confirmation', async () => {
    let actor: string | undefined;
    service.createPayrollRun.mockImplementationOnce(async () => { actor = getCurrentUser()?.id; return { id: RUN } as never; });
    await request(app()).post(`${BASE}/runs`).send({ companyId: COMPANY, periodId: PERIOD, name: 'Synthetic', createdBy: 'forged' }).expect(201);
    expect(actor).toBe(ACTOR); expect(service.createPayrollRun).toHaveBeenCalledWith({ companyId: COMPANY, periodId: PERIOD, name: 'Synthetic' }, ACTOR);
    await request(app()).patch(`${BASE}/runs/${RUN}/approve`).send({ userId: 'forged' }).expect(200);
    expect(service.approvePayrollRun).toHaveBeenCalledWith(RUN, ACTOR);
    await request(app()).put(`${BASE}/periods/${PERIOD}/confirm-attendance`).send({ userId: 'forged' }).expect(200);
    expect(service.confirmAttendanceReview).toHaveBeenCalledWith(PERIOD, ACTOR);
  });
});
