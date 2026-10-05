let contractFindFirst: jest.Mock;
let contractUpdate: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  contractFindFirst = jest.fn();
  contractUpdate = jest.fn(async ({ data }: { data: unknown }) => data);
  const client = { employmentContract: { findFirst: contractFindFirst, update: contractUpdate } };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

import { employmentContractService } from './employment-contract.service';

const probation = (over: Record<string, unknown> = {}) => ({
  id: 'c1', status: 'ACTIVE', type: 'PROBATION',
  startDate: new Date('2026-07-01T00:00:00Z'),
  endDate: new Date('2026-09-30T00:00:00Z'),
  ...over,
});
const decide = (input: Record<string, unknown>) =>
  employmentContractService.decideProbation('company-1', 'c1', input as never, 'user-9');

describe('probation review decision', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records who decided and when, and renews on PASS', async () => {
    contractFindFirst.mockResolvedValueOnce(probation());

    await decide({ decision: 'PASS', notes: 'Memenuhi ekspektasi' });

    const [[call]] = contractUpdate.mock.calls;
    expect(call.data).toMatchObject({
      probationDecision: 'PASS', probationDecidedBy: 'user-9',
      probationNotes: 'Memenuhi ekspektasi', status: 'RENEWED',
    });
    expect(call.data.probationDecidedAt).toBeInstanceOf(Date);
  });

  it('terminates on FAIL', async () => {
    contractFindFirst.mockResolvedValueOnce(probation());

    await decide({ decision: 'FAIL', notes: 'Tidak memenuhi' });

    expect(contractUpdate.mock.calls[0][0].data).toMatchObject({ probationDecision: 'FAIL', status: 'TERMINATED' });
  });

  it('refuses an extension that is not actually later', async () => {
    contractFindFirst.mockResolvedValueOnce(probation());

    await expect(decide({ decision: 'EXTEND', extendToDate: '2026-09-25T00:00:00Z' }))
      .rejects.toThrow(/setelah tanggal akhir/i);
    expect(contractUpdate).not.toHaveBeenCalled();
  });

  it('moves the end date on EXTEND and restarts the reminder cycle', async () => {
    contractFindFirst.mockResolvedValueOnce(probation({ endDate: new Date('2026-08-31T00:00:00Z') }));

    await decide({ decision: 'EXTEND', extendToDate: '2026-09-30T00:00:00Z' });

    const [[call]] = contractUpdate.mock.calls;
    expect(call.data).toMatchObject({ probationDecision: 'EXTEND', lastReminderDays: null });
    expect(call.data.endDate).toEqual(new Date('2026-09-30T00:00:00Z'));
    // An extension is not a status change: the contract is still running.
    expect(call.data.status).toBeUndefined();
  });

  it('refuses an extension past the three-month statutory cap', async () => {
    contractFindFirst.mockResolvedValueOnce(probation());

    // Extending a probation past three months voids the clause (UU 13/2003
    // art. 60), and dismissing on a void clause is unlawful termination — so
    // the cap is re-checked here, not only at creation.
    await expect(decide({ decision: 'EXTEND', extendToDate: '2026-12-01T00:00:00Z' }))
      .rejects.toThrow(/tiga|3 bulan|maksimal/i);
  });

  it('refuses EXTEND with no new date', async () => {
    contractFindFirst.mockResolvedValueOnce(probation());

    await expect(decide({ decision: 'EXTEND' })).rejects.toThrow(/extendToDate/);
  });

  it('refuses a decision on a contract that is not a probation', async () => {
    contractFindFirst.mockResolvedValueOnce(probation({ type: 'CONTRACT' }));

    await expect(decide({ decision: 'PASS' })).rejects.toThrow(/masa percobaan/i);
  });

  it('refuses a decision on a contract that is no longer active', async () => {
    contractFindFirst.mockResolvedValueOnce(probation({ status: 'TERMINATED' }));

    await expect(decide({ decision: 'PASS' })).rejects.toThrow(/aktif/i);
  });
});
