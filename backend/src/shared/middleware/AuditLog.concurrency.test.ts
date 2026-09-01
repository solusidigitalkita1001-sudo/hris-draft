import { appendAuditLogEntry } from './AuditLog';
import * as advisoryLock from '@/shared/database/advisory-lock';

describe('appendAuditLogEntry concurrency safety', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads the previous hash and inserts through the transaction protected by a per-company lock', async () => {
    const previousCreatedAt = new Date(Date.now() + 1_000);
    const tx = {
      auditLog: {
        findFirst: jest.fn().mockResolvedValue({ hash: 'previous-hash', createdAt: previousCreatedAt }),
        create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
      },
    };
    const lock = jest.spyOn(advisoryLock, 'withDatabaseAdvisoryLock').mockImplementation(
      async (_namespace, _key, operation) => operation(tx as any),
    );

    await appendAuditLogEntry({
      companyId: 'company-1',
      userId: 'user-1',
      action: 'UPDATE',
      entity: 'Employee',
      entityId: 'employee-1',
    });

    expect(lock).toHaveBeenCalledWith('audit-chain', 'company-1', expect.any(Function));
    expect(tx.auditLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'company-1' },
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        prevHash: 'previous-hash',
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        createdAt: new Date(previousCreatedAt.getTime() + 1),
      }),
    });
  });
});
