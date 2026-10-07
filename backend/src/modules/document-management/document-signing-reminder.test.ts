let signerFindMany: jest.Mock;
let signerUpdate: jest.Mock;
let notificationCreate: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  signerFindMany = jest.fn();
  signerUpdate = jest.fn(async () => ({}));
  notificationCreate = jest.fn(async () => ({}));
  const client = {
    documentSigner: { findMany: signerFindMany, update: signerUpdate },
    notification: { create: notificationCreate },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  runInSystemContext: (_label: string, fn: () => unknown) => fn(),
}));

import { sweepSigningReminders } from './document-signing-reminder.service';

const NOW = new Date('2026-10-05T00:00:00Z');
const inDays = (days: number) => new Date(Date.UTC(2026, 9, 5 + days));

/** One pending signer on a document, with the pending set it belongs to. */
const signer = (over: Record<string, unknown> = {}, pendingOrders = [1]) => ({
  id: 'signer-1', userId: 'user-1', order: 1, dueAt: inDays(2), lastReminderDays: null,
  document: {
    id: 'doc-1', title: 'Perjanjian Kerja', companyId: 'company-a',
    signers: pendingOrders.map(order => ({ order })),
  },
  ...over,
});

describe('document signing reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reminds the signer whose deadline is approaching, and records the tier', async () => {
    signerFindMany.mockResolvedValueOnce([signer()]);

    const result = await sweepSigningReminders(NOW);

    expect(result).toMatchObject({ checked: 1, notified: 1, overdue: 0 });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', action: 'SIGNATURE_DUE', type: 'WARNING' }),
    });
    // 2 days out falls in the 3-day tier.
    expect(signerUpdate).toHaveBeenCalledWith({ where: { id: 'signer-1' }, data: { lastReminderDays: 3 } });
  });

  it('does not remind the same tier twice', async () => {
    signerFindMany.mockResolvedValueOnce([signer({ lastReminderDays: 3 })]);

    const result = await sweepSigningReminders(NOW);

    expect(result).toMatchObject({ notified: 0, skipped: 1 });
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('still reminds when the deadline moves into a tighter tier', async () => {
    // Reminded at the 7-day tier, now one day out: the 1-day tier is new.
    signerFindMany.mockResolvedValueOnce([signer({ lastReminderDays: 7, dueAt: inDays(1) })]);

    await sweepSigningReminders(NOW);

    expect(signerUpdate).toHaveBeenCalledWith({ where: { id: 'signer-1' }, data: { lastReminderDays: 1 } });
  });

  it('stays silent for a signer whose turn has not come', async () => {
    // Step 2 while step 1 is still pending: signing would be refused anyway.
    signerFindMany.mockResolvedValueOnce([signer({ order: 2 }, [1, 2])]);

    const result = await sweepSigningReminders(NOW);

    expect(result).toMatchObject({ notified: 0, skipped: 1 });
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('sends an overdue notice once, as an error rather than a warning', async () => {
    signerFindMany.mockResolvedValueOnce([signer({ dueAt: inDays(-4) })]);

    const result = await sweepSigningReminders(NOW);

    expect(result).toMatchObject({ notified: 1, overdue: 1 });
    expect(notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'ERROR', title: expect.stringContaining('melewati tenggat') }),
    });
    expect(signerUpdate).toHaveBeenCalledWith({ where: { id: 'signer-1' }, data: { lastReminderDays: 0 } });
  });

  it('does not repeat the overdue notice on the following day', async () => {
    signerFindMany.mockResolvedValueOnce([signer({ dueAt: inDays(-5), lastReminderDays: 0 })]);

    expect(await sweepSigningReminders(NOW)).toMatchObject({ notified: 0, skipped: 1 });
  });
});
