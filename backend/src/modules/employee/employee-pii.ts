import { getCurrentRoles, getCurrentUser } from '@/shared/context/RequestContext';

/**
 * Field-level security for employee PII (checklist §2): NIK, NPWP, bank and
 * BPJS numbers are masked to last-4 in API responses unless the requester is
 * an HR/admin role or holds the explicit `employee:read-sensitive` permission.
 * Masked-by-default so a role without RoleDataScope configuration can never
 * read a colleague's bank account in clear.
 */
const SENSITIVE_EMPLOYEE_FIELDS = [
  'idNumber',
  'taxId',
  'bankAccount',
  'bankAccountHolder',
  'bpjsKetenagakerjaan',
  'bpjsKesehatan',
] as const;

// ponytail: role fallback keeps existing HR flows working on databases where
// the employee:read-sensitive permission has not been seeded yet.
const SENSITIVE_READ_ROLES = new Set(['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF']);

export function canReadSensitiveEmployeeData(): boolean {
  if (getCurrentRoles().some((role) => SENSITIVE_READ_ROLES.has(role))) return true;
  const permissions = getCurrentUser()?.permissions ?? [];
  return permissions.includes('employee:read-sensitive') || permissions.includes('employee:*');
}

function last4(value: unknown): string {
  const s = String(value);
  return s.length <= 4 ? '****' : '*'.repeat(s.length - 4) + s.slice(-4);
}

type Row = Record<string, unknown>;

function maskRow<T extends Row>(row: T): T {
  const masked: Row = { ...row };
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
    if (masked[field] != null) masked[field] = last4(masked[field]);
  }
  return masked as T;
}

/** Mask one employee row (or null) unless the requester may read PII raw. */
export function serializeEmployee<T extends Row | null>(row: T): T {
  if (!row || canReadSensitiveEmployeeData()) return row;
  return maskRow(row) as T;
}

/** Mask a list of employee rows unless the requester may read PII raw. */
export function serializeEmployees<T extends Row>(rows: T[]): T[] {
  if (canReadSensitiveEmployeeData()) return rows;
  return rows.map((row) => maskRow(row));
}

export { SENSITIVE_EMPLOYEE_FIELDS };
