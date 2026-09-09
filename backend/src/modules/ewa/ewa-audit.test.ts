import { diffAuditFields } from '@/shared/middleware/AuditLog';
import { EWA_AUDIT_REDACTIONS } from './ewa-access';

describe('EWA audit redaction', () => {
  it('keeps actors and status changes while removing amounts, salary-derived snapshots and private narratives from both snapshots', () => {
    const sensitive = Object.fromEntries(EWA_AUDIT_REDACTIONS.map(field => [field, `PRIVATE-${field}`]));
    const before = { ...sensitive, status: 'PENDING' };
    const after = { ...Object.fromEntries(EWA_AUDIT_REDACTIONS.map(field => [field, `UPDATED-${field}`])), status: 'APPROVED', approverId: 'checker' };
    for (const result of [diffAuditFields(before, after, EWA_AUDIT_REDACTIONS), diffAuditFields(null, after, EWA_AUDIT_REDACTIONS)]) {
      const json = JSON.stringify(result);
      expect(json).not.toContain('PRIVATE-'); expect(json).not.toContain('UPDATED-');
      expect(JSON.parse(result.newValue ?? '{}')).toMatchObject({ status: 'APPROVED', approverId: 'checker', amountRequested: '[redacted]', employee: '[redacted]' });
    }
  });
});
