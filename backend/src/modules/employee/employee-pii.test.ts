import { runInRequestContext } from '@/shared/context/RequestContext';
import { canReadSensitiveEmployeeData, serializeEmployee, serializeEmployees } from './employee-pii';

const employeeRow = {
  id: 'emp-1',
  fullName: 'Budi Santoso',
  idNumber: '3174091201900001',
  taxId: '012345678901000',
  bankAccount: '1234567890',
  bankAccountHolder: 'Budi Santoso',
  bpjsKetenagakerjaan: '11223344556',
  bpjsKesehatan: '0001234567890',
  email: 'budi@acme.co',
};

const asRole = <T>(roles: string[], permissions: string[], fn: () => T): T =>
  runInRequestContext({ user: { id: 'u', email: 'e@e.co', roles, permissions } as never }, fn);

describe('employee PII field-level masking', () => {
  it('masks NIK, NPWP, bank and BPJS numbers for plain employees', () => {
    const masked = asRole(['EMPLOYEE'], [], () => serializeEmployee({ ...employeeRow }));
    expect(masked.idNumber).toBe('************0001');
    expect(masked.taxId).toMatch(/^\*+1000$/);
    expect(masked.bankAccount).toBe('******7890');
    expect(masked.bpjsKetenagakerjaan).toMatch(/^\*+4556$/);
    expect(masked.bpjsKesehatan).toMatch(/^\*+7890$/);
    expect(masked.email).toBe('budi@acme.co');
    expect(masked.fullName).toBe('Budi Santoso');
  });

  it.each(['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF'])(
    'returns raw values for %s', (role) => {
      const raw = asRole([role], [], () => serializeEmployee({ ...employeeRow }));
      expect(raw.idNumber).toBe(employeeRow.idNumber);
      expect(raw.bankAccount).toBe(employeeRow.bankAccount);
    },
  );

  it('honors the explicit employee:read-sensitive permission', () => {
    const raw = asRole(['MANAGER'], ['employee:read-sensitive'], () => serializeEmployee({ ...employeeRow }));
    expect(raw.taxId).toBe(employeeRow.taxId);
    expect(asRole(['MANAGER'], ['employee:read-sensitive'], () => canReadSensitiveEmployeeData())).toBe(true);
  });

  it('masks every row of a list and leaves null fields alone', () => {
    const rows = asRole(['EMPLOYEE'], [], () => serializeEmployees([
      { ...employeeRow },
      { id: 'emp-2', idNumber: null, bankAccount: undefined },
    ]));
    expect(rows[0].bankAccount).toBe('******7890');
    expect(rows[1].idNumber).toBeNull();
    expect(rows[1].bankAccount).toBeUndefined();
  });

  it('does not mutate the original row', () => {
    const original = { ...employeeRow };
    asRole(['EMPLOYEE'], [], () => serializeEmployee(original));
    expect(original.idNumber).toBe(employeeRow.idNumber);
  });
});
