import { computeAuditHash, verifyAuditHash, verifyAuditChain, AuditHashPayload } from './audit-hash';

const base: AuditHashPayload = {
  companyId: 'c1',
  userId: 'u1',
  action: 'UPDATE',
  entity: 'employee',
  entityId: 'e1',
  oldValue: '{"salary":100}',
  newValue: '{"salary":200}',
  createdAt: new Date(Date.UTC(2024, 0, 1, 8, 0, 0)),
};

describe('audit integrity hash (hardening Audit Log)', () => {
  it('deterministik untuk input yang sama', () => {
    expect(computeAuditHash(base, '')).toBe(computeAuditHash(base, ''));
  });

  it('berubah jika salah satu field diubah (tamper terdeteksi)', () => {
    const tampered = { ...base, newValue: '{"salary":999}' };
    expect(computeAuditHash(tampered, '')).not.toBe(computeAuditHash(base, ''));
  });

  it('berubah jika prevHash berbeda (chaining)', () => {
    expect(computeAuditHash(base, 'aaa')).not.toBe(computeAuditHash(base, 'bbb'));
  });

  it('verifyAuditHash true untuk hash valid, false untuk yang dipalsukan', () => {
    const h = computeAuditHash(base, '');
    expect(verifyAuditHash(base, '', h)).toBe(true);
    expect(verifyAuditHash(base, '', 'deadbeef')).toBe(false);
    expect(verifyAuditHash({ ...base, action: 'DELETE' }, '', h)).toBe(false);
  });

  describe('verifyAuditChain', () => {
    it('rantai utuh → ok', () => {
      const h1 = computeAuditHash(base, '');
      const e2 = { ...base, action: 'DELETE', createdAt: new Date(Date.UTC(2024, 0, 2)) };
      const h2 = computeAuditHash(e2, h1);
      const chain = [
        { ...base, id: '1', hash: h1, prevHash: '' },
        { ...e2, id: '2', hash: h2, prevHash: h1 },
      ];
      expect(verifyAuditChain(chain).ok).toBe(true);
    });

    it('mendeteksi baris yang di-tamper', () => {
      const h1 = computeAuditHash(base, '');
      const chain = [
        { ...base, id: '1', hash: h1, prevHash: '' },
        // baris ke-2 di-tamper: newValue diubah tapi hash lama dipertahankan
        { ...base, id: '2', newValue: '{"salary":999}', hash: h1, prevHash: h1 },
      ];
      const r = verifyAuditChain(chain);
      expect(r.ok).toBe(false);
      expect(r.tamperedAt?.id).toBe('2');
    });
  });
});
