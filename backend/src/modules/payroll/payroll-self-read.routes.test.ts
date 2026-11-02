import express, { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { AppError } from '@/shared/exceptions/AppError';

jest.mock('@/shared/logger/WinstonLogger', () => ({ WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })), logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/shared/middleware/Authenticate', () => ({ authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
  next();
} }));
jest.mock('@/shared/middleware/AuditLog', () => ({ auditLog: () => (_req: unknown, _res: unknown, next: NextFunction) => next(), auditView: () => (_req: unknown, _res: unknown, next: NextFunction) => next(), appendAuditLogEntry: jest.fn(), createAuditLog: jest.fn() }));
jest.mock('./payroll-payment.routes', () => ({ __esModule: true, default: (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('./payroll-formula.routes', () => ({ __esModule: true, default: (_req: unknown, _res: unknown, next: NextFunction) => next() }));
jest.mock('@/modules/administration/administration.repository', () => ({ administrationRepository: { findMyDataScopeByUser: jest.fn().mockResolvedValue(null) } }));
jest.mock('@/shared/security/manager-team', () => ({ resolveManagedEmployeeIds: jest.fn().mockResolvedValue([]) }));
jest.mock('@/shared/security/employee-data-scope', () => ({ employeeAccessWhere: jest.fn(), assertEmployeeInScope: jest.fn() }));
jest.mock('./annual-tax-recap.service', () => ({ annualTaxRecapService: { build: jest.fn(), buildBuktiPotong: jest.fn() }, recapToCsv: jest.fn() }));
jest.mock('./payroll.service', () => ({ payrollService: { calculateEmployeeThr: jest.fn() } }));

import { employeeAccessWhere } from '@/shared/security/employee-data-scope';
import { annualTaxRecapService } from './annual-tax-recap.service';
import { payrollService } from './payroll.service';
import router from './payroll.routes';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const COMPANY = '11111111-1111-4111-8111-111111111111';
const SELF = '44444444-4444-4444-8444-444444444444', COLLEAGUE = '55555555-5555-4555-8555-555555555555';
const BASE = '/api/v1/payroll';

/**
 * With `payroll:read` revoked from the EMPLOYEE role, the by-employee payroll
 * reads had to stop treating "my own figures" as a company-wide act. The owner
 * of the data reaches them with no payroll permission at all; everybody else
 * still needs `payroll:read`, and for the annual-tax family the company-wide
 * payroll scope on top — a branch-scoped reader must not pull a year of
 * somebody's income.
 */
function app(options: { authenticated?: boolean; permissions?: string[]; employeeId?: string | null } = {}) {
  const instance = express(); instance.use(express.json());
  instance.use((req: AuthenticatedRequest, _res, next) => {
    if (options.authenticated !== false) req.user = { id: 'actor', email: 'self@example.test', companyId: COMPANY,
      employeeId: options.employeeId === undefined ? SELF : options.employeeId ?? undefined,
      companyScope: [COMPANY], roles: ['EMPLOYEE'], permissions: options.permissions ?? [] };
    next();
  });
  instance.use(BASE, router);
  instance.use((error: AppError, _req: AuthenticatedRequest, res: Response, _next: NextFunction) =>
    res.status(error.statusCode ?? 500).json({ message: error.message }));
  return instance;
}

const recap = jest.mocked(annualTaxRecapService);
const payroll = jest.mocked(payrollService);

describe('own payroll figures without a company-wide payroll permission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(employeeAccessWhere).mockResolvedValue({ companyId: COMPANY });
  });

  it('lets the owner read their annual tax recap and bukti potong', async () => {
    recap.build.mockResolvedValue({ year: 2026 } as never);
    recap.buildBuktiPotong.mockResolvedValue({ year: 2026 } as never);
    await request(app()).get(`${BASE}/annual-tax-recap/${SELF}?year=2026`).expect(200);
    await request(app()).get(`${BASE}/bukti-potong-1721-a1/${SELF}?year=2026`).expect(200);
    expect(recap.build).toHaveBeenCalledWith(COMPANY, SELF, 2026);
    expect(recap.buildBuktiPotong).toHaveBeenCalledWith(COMPANY, SELF, 2026);
  });

  it('lets the owner read their own THR', async () => {
    payroll.calculateEmployeeThr.mockResolvedValue({ amount: 1 } as never);
    await request(app()).get(`${BASE}/employees/${SELF}/thr`).expect(200);
    expect(payroll.calculateEmployeeThr).toHaveBeenCalledWith(SELF, undefined);
  });

  it.each([`/annual-tax-recap/${COLLEAGUE}?year=2026`, `/bukti-potong-1721-a1/${COLLEAGUE}?year=2026`, `/employees/${COLLEAGUE}/thr`])(
    'refuses %s to a colleague with no payroll permission, before any read',
    async path => {
      const response = await request(app()).get(`${BASE}${path}`).expect(403);
      expect(response.body.message).toMatch(/payroll:read/);
      expect(recap.build).not.toHaveBeenCalled();
      expect(recap.buildBuktiPotong).not.toHaveBeenCalled();
      expect(payroll.calculateEmployeeThr).not.toHaveBeenCalled();
    },
  );

  it('still demands authentication, and an own-record claim it can verify', async () => {
    await request(app({ authenticated: false })).get(`${BASE}/annual-tax-recap/${SELF}?year=2026`).expect(401);
    // No employee identity in the session: there is no "own record" to match,
    // so the permission is the only way in.
    await request(app({ employeeId: null })).get(`${BASE}/annual-tax-recap/${SELF}?year=2026`).expect(403);
    expect(recap.build).not.toHaveBeenCalled();
  });

  it('keeps the annual-tax family company-wide for anyone reading somebody else', async () => {
    recap.build.mockResolvedValue({ year: 2026 } as never);
    // A reader restricted to one employee is not a company-wide payroll reader.
    jest.mocked(employeeAccessWhere).mockResolvedValue({ companyId: COMPANY, id: SELF });
    await request(app({ permissions: ['payroll:read'] })).get(`${BASE}/annual-tax-recap/${COLLEAGUE}?year=2026`).expect(403);
    expect(recap.build).not.toHaveBeenCalled();
    // The same restricted reader still reads their own.
    await request(app({ permissions: ['payroll:read'] })).get(`${BASE}/annual-tax-recap/${SELF}?year=2026`).expect(200);
    // Company-wide scope opens the colleague's recap, as it always did.
    jest.mocked(employeeAccessWhere).mockResolvedValue({ companyId: COMPANY });
    await request(app({ permissions: ['payroll:read'] })).get(`${BASE}/annual-tax-recap/${COLLEAGUE}?year=2026`).expect(200);
    expect(recap.build).toHaveBeenCalledWith(COMPANY, COLLEAGUE, 2026);
  });
});
