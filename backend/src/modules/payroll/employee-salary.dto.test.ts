import { randomUUID } from 'node:crypto';
import { createEmployeeSalarySchema, updateEmployeeSalarySchema } from './payroll.dto';

const componentId = randomUUID();
const valid = { employeeId: randomUUID(), effectiveDate: '2026-09-01T05:00:00Z', baseSalary: 1000.25,
  components: [{ salaryComponentId: componentId, amount: 1000.25 }] };

describe('salary allocation input contract', () => {
  it('accepts exact cents and the Decimal(15,2) limit without requiring client company or actor fields', () => {
    expect(createEmployeeSalarySchema.parse({ ...valid, actorId: 'forged', status: 'APPROVED' })).toEqual({ ...valid, currency: 'IDR' });
    expect(createEmployeeSalarySchema.safeParse({ ...valid, baseSalary: 9999999999999.99 }).success).toBe(true);
  });
  it.each([0, -1, NaN, Infinity, 10000000000000, 0.001, 1000.251])('rejects invalid salary and component amount %s', amount => {
    expect(createEmployeeSalarySchema.safeParse({ ...valid, baseSalary: amount }).success).toBe(false);
    expect(updateEmployeeSalarySchema.safeParse({ baseSalary: amount }).success).toBe(false);
    expect(createEmployeeSalarySchema.safeParse({ ...valid, components: [{ salaryComponentId: componentId, amount }] }).success).toBe(false);
  });
  it.each(['USD', null, ''])('rejects unsupported currency %s', currency => {
    expect(createEmployeeSalarySchema.safeParse({ ...valid, currency }).success).toBe(false);
    expect(updateEmployeeSalarySchema.safeParse({ currency }).success).toBe(false);
  });
  it('rejects duplicate and excessive component allocations on create and update', () => {
    for (const components of [[...valid.components, ...valid.components], Array.from({ length: 513 }, () => ({ salaryComponentId: randomUUID(), amount: 1 }))]) {
      expect(createEmployeeSalarySchema.safeParse({ ...valid, components }).success).toBe(false);
      expect(updateEmployeeSalarySchema.safeParse({ components }).success).toBe(false);
    }
  });
  it.each(['2026-02-30T00:00:00Z', 'invalid', '2026-09-01', '2026-13-01T00:00:00Z'])('rejects invalid effective date %s', effectiveDate => {
    expect(createEmployeeSalarySchema.safeParse({ ...valid, effectiveDate }).success).toBe(false);
    expect(updateEmployeeSalarySchema.safeParse({ effectiveDate }).success).toBe(false);
  });
  it('rejects null money, empty patches and identity-only patches while allowing an explicit empty allocation list', () => {
    expect(createEmployeeSalarySchema.safeParse({ ...valid, baseSalary: null }).success).toBe(false);
    expect(updateEmployeeSalarySchema.safeParse({}).success).toBe(false);
    expect(updateEmployeeSalarySchema.safeParse({ companyId: randomUUID(), employeeId: randomUUID() }).success).toBe(false);
    expect(updateEmployeeSalarySchema.parse({ components: [], companyId: randomUUID() })).toEqual({ components: [] });
  });
});
