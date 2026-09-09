import { diffAuditFields } from './AuditLog';

const sensitive = ['baseSalary', 'components', 'notes', 'employee'];
describe('salary audit redaction', () => {
  it('preserves the names of changed fields without exposing salary, component amounts, notes or nested employee data', () => {
    const before = { id: 'salary', baseSalary: '1000.25', notes: 'private before', currency: 'IDR', isActive: true };
    const after = { ...before, baseSalary: '2000.75', notes: 'private after', components: [{ amount: '999.99' }], employee: { fullName: 'Private Employee' }, isActive: false };
    const result = diffAuditFields(before, after, sensitive);
    expect(JSON.parse(result.oldValue ?? '{}')).toEqual({ baseSalary: '[redacted]', notes: '[redacted]', isActive: true });
    expect(JSON.parse(result.newValue ?? '{}')).toEqual({ baseSalary: '[redacted]', notes: '[redacted]', components: '[redacted]', employee: '[redacted]', isActive: false });
  });
  it('redacts both creation and deletion snapshots while retaining non-sensitive currency and effective date', () => {
    const value = { baseSalary: '1000.25', components: [{ amount: '1000.25' }], currency: 'IDR', effectiveDate: '2026-09-01' };
    for (const result of [diffAuditFields(null, value, sensitive).newValue, diffAuditFields(value, null, sensitive).oldValue]) {
      expect(JSON.parse(result ?? '{}')).toEqual({ baseSalary: '[redacted]', components: '[redacted]', currency: 'IDR', effectiveDate: '2026-09-01' });
    }
  });
  it('retains the existing default diff policy and omits unchanged sensitive fields', () => {
    expect(diffAuditFields({ baseSalary: 1000 }, { baseSalary: 1000 }, sensitive)).toEqual({});
    const result = diffAuditFields({ phone: '12345678', name: 'A' }, { phone: '87654321', name: 'B' });
    expect(JSON.parse(result.newValue ?? '{}')).toEqual({ phone: '****4321', name: 'B' });
  });
});
