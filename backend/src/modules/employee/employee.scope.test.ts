jest.mock('@/shared/database/prisma', () => ({ prisma: { employee: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) } } }));
jest.mock('@/modules/administration/administration.service', () => ({ administrationService: {
  findMyDataScopeByUser: jest.fn().mockResolvedValue({ scopeType: 'EMPLOYEE_SELF' }),
  resolveEmployeeFilterForCurrentUser: jest.fn().mockReturnValue({ id: 'self' }),
} }));
import { EmployeeRepository } from './employee.repository';
import { prisma } from '@/shared/database/prisma';
import { runInRequestContext } from '@/shared/context/RequestContext';
const repo = new EmployeeRepository();
const run = (callback: () => Promise<unknown>) => runInRequestContext({ user: { id: 'u', email: 'u@example.com', employeeId: 'self', companyId: 'A', roles: ['EMPLOYEE'] } }, callback);
describe('employee server data scope', () => {
  beforeEach(() => jest.clearAllMocks());
  it('enforces self scope for lists and counts even without a query employeeId', async () => {
    await run(() => repo.findAll({ companyId: 'A', page: 1, limit: 20 }));
    for (const query of [prisma.employee.findMany, prisma.employee.count]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: [{ id: 'self', companyId: 'A' }] }) }));
    }
  });
  it('intersects forged detail IDs with self scope before reading', async () => {
    await run(() => repo.findById('other'));
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other', deletedAt: null, AND: [{ id: 'self', companyId: 'A' }] } }));
  });
  it('enforces scope again at the mutation query', async () => {
    await run(() => repo.update('other', { firstName: 'Changed' }));
    expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other', AND: [{ id: 'self', companyId: 'A' }] } }));
  });
  it('rejects requests with no authenticated or system context', async () => {
    await expect(repo.findById('other')).rejects.toThrow('active company');
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });
});
