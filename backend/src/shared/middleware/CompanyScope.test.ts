import { requireCompanyAccess } from './CompanyScope';
import { ForbiddenError } from '@/shared/exceptions/AppError';

function makeReq(overrides: any = {}) {
  return {
    user: overrides.user,
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
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

  it('SUPER_ADMIN bypass tanpa normalisasi', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['SUPER_ADMIN'] }, query: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalled();
    expect(req.query.companyId).toBe('B');
  });

  it('GROUP_ADMIN bypass', async () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['GROUP_ADMIN'] }, query: { companyId: 'B' } });
    const next = await run(req);
    expect(next).toHaveBeenCalled();
  });
});
