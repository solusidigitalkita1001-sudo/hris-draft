import type { Prisma } from '@prisma/client';
import { enforceTenantScope } from './tenant-scope';
function params(action: Prisma.PrismaAction, args: Record<string, unknown>, model: Prisma.MiddlewareParams['model'] = 'Employee'): Prisma.MiddlewareParams {
  return { model, action, args, dataPath: [], runInTransaction: false };
}
describe('tenant constraint enforcement', () => {
  it.each(['findMany', 'findUnique', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'] as const)(
    'intersects forged company filters for %s', async action => {
      const request = params(action, { where: { id: 'foreign', companyId: { in: ['A', 'B'] }, OR: [{ companyId: 'B' }] }, data: { firstName: 'Name' } });
      await enforceTenantScope(request, 'A');
      expect(request.args.where).toEqual({ id: 'foreign', companyId: { in: ['A', 'B'] }, OR: [{ companyId: 'B' }], AND: [{ companyId: 'A' }] });
    },
  );
  it('retains caller AND constraints without allowing them to replace the active company', async () => {
    const request = params('findFirst', { where: { AND: { companyId: 'B' } } });
    await enforceTenantScope(request, 'A');
    expect(request.args.where.AND).toEqual([{ companyId: 'B' }, { companyId: 'A' }]);
  });
  it.each(['create', 'update', 'updateMany'] as const)('rejects cross-company %s payloads', async action => {
    await expect(enforceTenantScope(params(action, { data: { companyId: 'B' } }), 'A')).rejects.toThrow();
    await expect(enforceTenantScope(params(action, { data: { companyId: { set: 'B' } } }), 'A')).rejects.toThrow();
    await expect(enforceTenantScope(params(action, { data: { company: { connect: { id: 'B' } } } }), 'A')).rejects.toThrow();
  });
  it('injects company into creates and validates every createMany row', async () => {
    const request = params('create', { data: { firstName: 'Name' } });
    await enforceTenantScope(request, 'A');
    expect(request.args.data.companyId).toBe('A');
    await expect(enforceTenantScope(params('createMany', { data: [{ companyId: 'A' }, { companyId: 'B' }] }), 'A')).rejects.toThrow();
  });
  it('checks both upsert branches', async () => {
    await expect(enforceTenantScope(params('upsert', { where: { id: 'id' }, create: { companyId: 'B' }, update: {} }), 'A')).rejects.toThrow();
    await expect(enforceTenantScope(params('upsert', { where: { id: 'id' }, create: {}, update: { companyId: 'B' } }), 'A')).rejects.toThrow();
  });
  it.each([['WorkflowInstanceStep', 'instance'], ['WorkflowInstanceLog', 'instance'], ['ExpenseApproval', 'claim']] as const)('scopes %s through its parent relation', async (model, relation) => {
    const request = params('findMany', { where: {} }, model);
    await enforceTenantScope(request, 'A');
    expect(request.args.where.AND).toEqual([{ [relation]: { companyId: 'A' } }]);
  });
  it('rejects parent reassignment on existing records', async () => {
    await expect(enforceTenantScope(params('update', { where: { id: 'step' }, data: { instanceId: 'foreign' } }, 'WorkflowInstanceStep'), 'A')).rejects.toThrow();
  });
});
