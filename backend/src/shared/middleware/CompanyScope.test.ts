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

const run = (req: any) => {
  const next = jest.fn();
  requireCompanyAccess()(req, {} as any, next);
  return next;
};

describe('requireCompanyAccess (multi-tenant isolation)', () => {
  it('menolak non-admin yang meminta company lain via query', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['HR_STAFF'] }, query: { companyId: 'B' } });
    expect(() => run(req)).toThrow(ForbiddenError);
  });

  it('menolak non-admin yang meminta company lain via body', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['MANAGER'] }, body: { companyId: 'B' } });
    expect(() => run(req)).toThrow(ForbiddenError);
  });

  it('menormalkan companyId ke company user saat tidak diisi', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['EMPLOYEE'] } });
    const next = run(req);
    expect(next).toHaveBeenCalled();
    expect(req.query.companyId).toBe('A');
    expect(req.company.id).toBe('A');
  });

  it('menimpa companyId body ke company user (cegah create lintas tenant)', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['HR_STAFF'] }, body: { companyId: 'A', name: 'x' } });
    run(req);
    expect(req.body.companyId).toBe('A');
  });

  it('mengizinkan company yang ada di companyScope (multi-company)', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', companyScope: ['A', 'B'], roles: ['HR_MANAGER'] }, query: { companyId: 'B' } });
    const next = run(req);
    expect(next).toHaveBeenCalled();
    expect(req.query.companyId).toBe('B');
  });

  it('SUPER_ADMIN bypass tanpa normalisasi', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['SUPER_ADMIN'] }, query: { companyId: 'B' } });
    const next = run(req);
    expect(next).toHaveBeenCalled();
    expect(req.query.companyId).toBe('B'); // tidak diubah
  });

  it('GROUP_ADMIN bypass', () => {
    const req = makeReq({ user: { id: 'u', companyId: 'A', roles: ['GROUP_ADMIN'] }, query: { companyId: 'B' } });
    expect(run(req)).toHaveBeenCalled();
  });
});
