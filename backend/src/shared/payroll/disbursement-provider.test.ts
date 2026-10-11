import {
  fallbackBankReference, resolveDisbursementProvider, SandboxDisbursementProvider,
} from './disbursement-provider';

describe('sandbox provider', () => {
  it('pays everything except accounts ending in 13, deterministically', async () => {
    const result = await new SandboxDisbursementProvider().submit('batch-1', [
      { referenceNo: 'REF-1', bankCode: 'BCA', accountNumber: '1234567890', accountHolder: 'A', amount: '100.00' },
      { referenceNo: 'REF-2', bankCode: 'BCA', accountNumber: '9990000013', accountHolder: 'B', amount: '200.00' },
    ]);
    expect(result.results).toEqual([
      { referenceNo: 'REF-1', status: 'PAID', providerRef: 'SBX-REF-1' },
      { referenceNo: 'REF-2', status: 'FAILED', failureReason: 'Rekening tidak ditemukan (SANDBOX)' },
    ]);
  });
});

describe('provider registry', () => {
  it('resolves SANDBOX case-insensitively and nothing else', () => {
    expect(resolveDisbursementProvider('sandbox')?.name).toBe('SANDBOX');
    expect(resolveDisbursementProvider('NONE')).toBeNull();
    expect(resolveDisbursementProvider('')).toBeNull();
    expect(resolveDisbursementProvider(undefined)).toBeNull();
  });
});

describe('fallback bank reference', () => {
  it('is unique per transaction — the ledger has @@unique([companyId, bankReference])', () => {
    const first = fallbackBankReference('IRIS', 'BATCH-9', 'REF-1');
    const second = fallbackBankReference('IRIS', 'BATCH-9', 'REF-2');
    expect(first).toBe('IRIS:BATCH-9:REF-1');
    expect(first).not.toBe(second);
  });
});
