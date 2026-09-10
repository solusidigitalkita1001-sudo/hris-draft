jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  default: { employee: { findFirst: jest.fn() } },
  prisma: { employee: { findFirst: jest.fn() } },
}));

import prisma from '@/shared/database/prisma';
import { runInRequestContext } from '@/shared/context/RequestContext';
import {
  assertCompanyAccessAuthority,
  assertEmployeeWithinScope,
  assertUserWithinScope,
} from './user-access-guard';

const asUser = (user: Record<string, unknown>, fn: () => unknown) =>
  runInRequestContext({ user: user as never }, fn);

const hrAdminOfA = { id: 'u1', email: 'a@a.co', companyId: 'company-A', companyScope: ['company-A'], roles: ['COMPANY_ADMIN'] };
const superAdmin = { id: 'u2', email: 's@s.co', roles: ['SUPER_ADMIN'], companyScope: [] };
const groupAdminG1 = { id: 'u3', email: 'g@g.co', groupId: 'group-1', companyScope: ['company-A', 'company-B'], roles: ['GROUP_ADMIN'] };

describe('assertCompanyAccessAuthority — tenant takeover guard', () => {
  it('blocks granting access to a company outside the requester scope', () => {
    expect(() => asUser(hrAdminOfA, () => assertCompanyAccessAuthority('company-B'))).toThrow(/outside your company scope/);
  });

  it('allows granting access to an administered company', () => {
    expect(() => asUser(hrAdminOfA, () => assertCompanyAccessAuthority('company-A'))).not.toThrow();
  });

  it('always allows SUPER_ADMIN', () => {
    expect(() => asUser(superAdmin, () => assertCompanyAccessAuthority('company-Z', { accessScope: 'GROUP_WIDE', groupId: 'any' }))).not.toThrow();
  });

  it('blocks GROUP_WIDE grants from a non group admin', () => {
    expect(() => asUser(hrAdminOfA, () => assertCompanyAccessAuthority('company-A', { accessScope: 'GROUP_WIDE' }))).toThrow(/Group-wide/);
  });

  it('blocks group admins from granting into another group', () => {
    expect(() => asUser(groupAdminG1, () => assertCompanyAccessAuthority('company-B', { groupId: 'group-2' }))).toThrow(/Group-wide/);
  });

  it('allows group admins within their own group', () => {
    expect(() => asUser(groupAdminG1, () => assertCompanyAccessAuthority('company-B', { accessScope: 'GROUP_WIDE', groupId: 'group-1' }))).not.toThrow();
  });
});

describe('assertUserWithinScope — cross-tenant user visibility', () => {
  it('404s a user from another tenant without leaking existence', () => {
    const foreign = { employee: { company: { id: 'company-B' } }, companyAccesses: [{ companyId: 'company-B' }] };
    expect(() => asUser(hrAdminOfA, () => assertUserWithinScope(foreign))).toThrow('User not found');
  });

  it('accepts a user attached to an administered company', () => {
    const local = { employee: { company: { id: 'company-A' } }, companyAccesses: [] };
    expect(() => asUser(hrAdminOfA, () => assertUserWithinScope(local))).not.toThrow();
  });

  it('never restricts SUPER_ADMIN', () => {
    expect(() => asUser(superAdmin, () => assertUserWithinScope({ companyAccesses: [] }))).not.toThrow();
  });
});

describe('assertEmployeeWithinScope — user↔employee linking', () => {
  const findFirst = (prisma as unknown as { employee: { findFirst: jest.Mock } }).employee.findFirst;

  it('blocks linking an employee from another tenant', async () => {
    findFirst.mockResolvedValue({ companyId: 'company-B' });
    await expect(asUser(hrAdminOfA, () => assertEmployeeWithinScope('emp-1'))).rejects.toThrow(/outside your scope/);
  });

  it('allows linking an employee of an administered company', async () => {
    findFirst.mockResolvedValue({ companyId: 'company-A' });
    await expect(asUser(hrAdminOfA, () => assertEmployeeWithinScope('emp-1'))).resolves.toBeUndefined();
  });

  it('404s a missing employee', async () => {
    findFirst.mockResolvedValue(null);
    await expect(asUser(hrAdminOfA, () => assertEmployeeWithinScope('emp-x'))).rejects.toThrow('Employee not found');
  });
});
