jest.mock('./AuditLog', () => ({ createAuditLog: jest.fn().mockResolvedValue(undefined) }));

import { requireCompanyAccess } from './CompanyScope';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { getCurrentCompanyId, runInRequestContext } from '@/shared/context/RequestContext';
import { createAuditLog } from './AuditLog';

function makeReq(overrides: any = {}) {
  return {
    user: overrides.user,
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    method: overrides.method ?? 'GET',
    baseUrl: overrides.baseUrl ?? '/api/v1/employees',
    path: overrides.path ?? '/',
    headers: overrides.headers ?? {},
    ip: overrides.ip ?? '127.0.0.1',
  } as any;
}

const run = async (req: any) => {
  const next = jest.fn();
  const mw = requireCompanyAccess();
  await mw(req, {} as any, next as any);
  return next;
};

describe('requireCompanyAccess (multi-tenant isolation)', () => {
  it('menolak non-admin yang meminta company lain via query', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['HR_STAFF'] }, query: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('menolak non-admin yang meminta company lain via body', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['MANAGER'] }, body: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('menormalkan companyId ke company user saat tidak diisi', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['EMPLOYEE'] } });
    const next = await run(req);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls.length).toBe(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(req.query.companyId).toBe('A');
    expect(req.company.id).toBe('A');
  });

  it('menimpa companyId body ke company user (cegah create lintas tenant)', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['HR_STAFF'] }, body: { companyId: 'A', name: 'x' } });
    await run(req);
    expect(req.body.companyId).toBe('A');
  });

  it('mengizinkan company yang ada di companyScope (multi-company)', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', companyScope: ['A', 'B'], roles: ['HR_MANAGER'] }, query: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(req.query.companyId).toBe('B');
  });

  it('propagates the validated selected company into downstream server context', async () => {
    const user = { id: 'u', email: 'u@example.com', companyId: 'A', companyScope: ['A', 'B'], roles: ['HR_MANAGER'] };
    const req = makeReq({ user, query: { companyId: 'B' } });
    let downstreamCompanyId: string | undefined;

    await runInRequestContext({ user }, async () => {
      await requireCompanyAccess()(req, {} as any, (() => {
        downstreamCompanyId = getCurrentCompanyId();
      }) as any);
    });

    expect(downstreamCompanyId).toBe('B');
    expect(req.user.companyId).toBe('B');
  });

  it('SUPER_ADMIN may select any explicit company and is normalized to it', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['SUPER_ADMIN'] }, query: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalled();
    expect(req.query.companyId).toBe('B');
  });

  it('GROUP_ADMIN may select only a company in its server-derived scope', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', companyScope: ['A', 'B'], roles: ['GROUP_ADMIN'] }, query: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects array/object company parameter manipulation for every role', async () => {
    for (const roles of [['SUPER_ADMIN'], ['GROUP_ADMIN'], ['EMPLOYEE']]) {
      const req = makeReq({ user: { id: 'u', companyId: 'A', companyScope: ['A'], roles }, query: { companyId: ['A', 'B'] } });
      const next = await run(req);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    }
  });
});

describe('requireCompanyAccess — SUPER_ADMIN platform account (no company rows)', () => {
  it('rejects a super admin with no explicitly selected company', async () => {
    const req = makeReq({ user: { id: 'sa', roles: ['SUPER_ADMIN'], companyScope: [] } });
    const next = await run(req);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(next.mock.calls[0][0].message).toMatch(/select an active company/i);
  });

  it('lets a super admin target any company explicitly', async () => {
    const req = makeReq({ user: { id: 'sa', roles: ['SUPER_ADMIN'], companyScope: [] }, query: { companyId: 'company-X' } });
    const next = await run(req);
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(req.company.id).toBe('company-X');
    expect(req.user.companyId).toBe('company-X');
  });

  it('writes a dedicated audit event for successful selected-company access', async () => {
    const finishHandlers: Array<() => void> = [];
    const res = {
      statusCode: 200,
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') finishHandlers.push(handler);
      }),
    } as any;
    const req = makeReq({
      user: { id: 'sa', email: 'sa@example.com', roles: ['SUPER_ADMIN'], companyScope: [] },
      query: { companyId: 'company-X' },
      method: 'GET',
      baseUrl: '/api/v1/employees',
      path: '/',
      headers: { 'user-agent': 'jest' },
    });
    const next = jest.fn();

    await requireCompanyAccess()(req, res, next);
    finishHandlers.forEach((handler) => handler());

    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-X',
      userId: 'sa',
      action: 'SUPER_ADMIN_TENANT_ACCESS',
      entity: 'API',
    }));
  });

  it('still 403s a regular user with no scope at all', async () => {
    const req = makeReq({ user: { id: 'u', roles: ['EMPLOYEE'], companyScope: [] } });
    const next = await run(req);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('still 403s a GROUP_ADMIN requesting outside their scope', async () => {
    const req = makeReq({ user: { id: 'ga', roles: ['GROUP_ADMIN'], companyScope: ['A', 'B'] }, query: { companyId: 'C' } });
    const next = await run(req);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
