import express, { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { AppError } from '@/shared/exceptions/AppError';
import { getCurrentCompanyId } from '@/shared/context/RequestContext';

jest.mock('@/shared/logger/WinstonLogger', () => ({ WinstonLogger: jest.fn().mockImplementation(() => ({ warn: jest.fn() })), logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/shared/middleware/Authenticate', () => ({ authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
  next();
} }));
jest.mock('@/shared/middleware/AuditLog', () => ({ auditLog: () => (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('./payroll-payment.routes', () => ({ __esModule: true, default: (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('./payroll-formula.routes', () => ({ __esModule: true, default: (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('@/shared/security/employee-data-scope', () => ({ employeeAccessWhere: jest.fn() }));
jest.mock('./payroll.service', () => ({ payrollService: {
  createEmployeeSalary: jest.fn(), updateEmployeeSalary: jest.fn(), findAllEmployeeSalaries: jest.fn(), findEmployeeSalaryById: jest.fn(), calculateEmployeeThr: jest.fn(),
} }));
import router from './payroll.routes';
import { payrollService } from './payroll.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const COMPANY = '11111111-1111-4111-8111-111111111111', FOREIGN = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333', EMPLOYEE = '44444444-4444-4444-8444-444444444444';
const SALARY = '55555555-5555-4555-8555-555555555555', COMPONENT = '66666666-6666-4666-8666-666666666666';
const BASE = '/api/v1/payroll/employee-salaries';
const payload = { employeeId: EMPLOYEE, baseSalary: 1000.25, effectiveDate: '2026-09-01T05:00:00Z', components: [{ salaryComponentId: COMPONENT, amount: 1000.25 }] };
function app(options: { authenticated?: boolean; permissions?: string[]; companyScope?: string[] } = {}) {
  const instance = express(); instance.use(express.json());
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (options.authenticated !== false) req.user = { id: ACTOR, email: 'salary@example.test', companyId: COMPANY,
      companyScope: options.companyScope ?? [COMPANY], roles: ['GROUP_ADMIN'], permissions: options.permissions ?? ['payroll:create', 'payroll:update', 'payroll:read'] };
    next();
  });
  instance.use('/api/v1/payroll', router);
  instance.use((error: AppError, _req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    res.status(error.statusCode ?? 500).json({ message: error.message });
  });
  return instance;
}
describe('salary allocation HTTP boundary', () => {
  beforeEach(() => jest.clearAllMocks());
  it('accepts omission of company and passes the validated company context while stripping forged server fields', async () => {
    let company: string | undefined;
    jest.mocked(payrollService.createEmployeeSalary).mockImplementationOnce(async () => { company = getCurrentCompanyId(); return { id: SALARY } as never; });
    await request(app()).post(BASE).send({ ...payload, createdBy: 'forged', actorId: 'forged', isActive: false, status: 'APPROVED' }).expect(201);
    expect(company).toBe(COMPANY);
    expect(payrollService.createEmployeeSalary).toHaveBeenCalledWith({ ...payload, currency: 'IDR' });
  });
  it('carries a permitted company switch into the service context', async () => {
    let company: string | undefined;
    jest.mocked(payrollService.createEmployeeSalary).mockImplementationOnce(async () => { company = getCurrentCompanyId(); return { id: SALARY } as never; });
    await request(app({ companyScope: [COMPANY, FOREIGN] })).post(BASE).send({ ...payload, companyId: FOREIGN }).expect(201);
    expect(company).toBe(FOREIGN);
  });
  it.each(['body', 'query'])('rejects an inaccessible company from %s before calling the salary service', async source => {
    await request(app()).post(source === 'query' ? `${BASE}?companyId=${FOREIGN}` : BASE)
      .send(source === 'body' ? { ...payload, companyId: FOREIGN } : payload).expect(403);
    expect(payrollService.createEmployeeSalary).not.toHaveBeenCalled();
  });
  it.each([{ baseSalary: 0.001 }, { currency: 'USD' }, { components: [...payload.components, ...payload.components] }])('rejects invalid financial input %j at the HTTP validator', async change => {
    await request(app()).post(BASE).send({ ...payload, ...change }).expect(422);
    expect(payrollService.createEmployeeSalary).not.toHaveBeenCalled();
  });
  it('preserves explicit component clearing but strips attempts to reassign employee or company on update', async () => {
    jest.mocked(payrollService.updateEmployeeSalary).mockResolvedValueOnce({ id: SALARY } as never);
    await request(app()).patch(`${BASE}/${SALARY}`).send({ components: [], employeeId: 'forged', companyId: COMPANY }).expect(200);
    expect(payrollService.updateEmployeeSalary).toHaveBeenCalledWith(SALARY, { components: [] });
  });
  it('rejects empty updates and malformed IDs before the service', async () => {
    await request(app()).patch(`${BASE}/${SALARY}`).send({}).expect(422);
    await request(app()).patch(`${BASE}/invalid`).send({ baseSalary: 1000 }).expect(422);
    expect(payrollService.updateEmployeeSalary).not.toHaveBeenCalled();
  });
  it('requires authentication and the matching create/update permission', async () => {
    await request(app({ authenticated: false })).post(BASE).send(payload).expect(401);
    await request(app({ permissions: ['payroll:read'] })).post(BASE).send(payload).expect(403);
    await request(app({ permissions: ['payroll:create'] })).patch(`${BASE}/${SALARY}`).send({ baseSalary: 1000 }).expect(403);
    expect(payrollService.createEmployeeSalary).not.toHaveBeenCalled(); expect(payrollService.updateEmployeeSalary).not.toHaveBeenCalled();
  });

  it('reads salary history using the validated active company and optional employee filter with no-store caching', async () => {
    let company: string | undefined;
    jest.mocked(payrollService.findAllEmployeeSalaries).mockImplementationOnce(async () => { company = getCurrentCompanyId(); return []; });
    const response = await request(app({ companyScope: [COMPANY, FOREIGN] })).get(`${BASE}?companyId=${FOREIGN}&employeeId=${EMPLOYEE}&branchId=forged`).expect(200);
    expect(company).toBe(FOREIGN);
    expect(payrollService.findAllEmployeeSalaries).toHaveBeenCalledWith(FOREIGN, EMPLOYEE);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each([BASE, `${BASE}/${SALARY}`, `/api/v1/payroll/employees/${EMPLOYEE}/thr`])('requires authentication and payroll:read for GET %s', async path => {
    for (const authenticated of [false, true]) {
      const options = authenticated ? { permissions: ['employee:read'] } : { authenticated: false };
      const response = await request(app(options)).get(path).expect(authenticated ? 403 : 401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(payrollService.findAllEmployeeSalaries).not.toHaveBeenCalled();
    expect(payrollService.findEmployeeSalaryById).not.toHaveBeenCalled();
    expect(payrollService.calculateEmployeeThr).not.toHaveBeenCalled();
  });
  it('rejects a foreign company selection on reads before the service', async () => {
    await request(app()).get(`${BASE}?companyId=${FOREIGN}`).expect(403);
    expect(payrollService.findAllEmployeeSalaries).not.toHaveBeenCalled();
  });
  it('validates salary and employee IDs and disallows structured employee query filters', async () => {
    await request(app()).get(`${BASE}/invalid`).expect(422);
    await request(app()).get(`${BASE}?employeeId=invalid`).expect(422);
    await request(app()).get(`${BASE}?employeeId[not]=${EMPLOYEE}`).expect(422);
    await request(app()).get('/api/v1/payroll/employees/invalid/thr').expect(422);
    expect(payrollService.findAllEmployeeSalaries).not.toHaveBeenCalled();
    expect(payrollService.findEmployeeSalaryById).not.toHaveBeenCalled();
    expect(payrollService.calculateEmployeeThr).not.toHaveBeenCalled();
  });
  it.each(['2026-09-09', '2026-09-09T12:00:00+07:00'])('accepts a real THR reference date %s', async date => {
    jest.mocked(payrollService.calculateEmployeeThr).mockResolvedValueOnce({ monthlyWage: 1000, amount: 1000 } as never);
    const response = await request(app()).get(`/api/v1/payroll/employees/${EMPLOYEE}/thr`).query({ date }).expect(200);
    expect(payrollService.calculateEmployeeThr).toHaveBeenCalledWith(EMPLOYEE, new Date(date));
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each(['2026-02-30', '2026-02-30T00:00:00Z', 'invalid', '2026-13-01'])('rejects invalid THR date %s before calculating', async date => {
    await request(app()).get(`/api/v1/payroll/employees/${EMPLOYEE}/thr`).query({ date }).expect(422);
    expect(payrollService.calculateEmployeeThr).not.toHaveBeenCalled();
  });
  it('preserves not-found errors without caching sensitive detail responses', async () => {
    jest.mocked(payrollService.findEmployeeSalaryById).mockRejectedValueOnce(new AppError('Not found', 404));
    const response = await request(app()).get(`${BASE}/${SALARY}`).expect(404);
    expect(response.body).toEqual({ message: 'Not found' }); expect(response.headers['cache-control']).toBe('no-store');
  });
});
