type Row = Record<string, unknown>;

const state: {
  document: Row | null;
  signers: Row[];
  users: Row[];
  actorId: string | null;
  updateCount: number;
  updates: Array<{ where: Row; data: Row }>;
  created: Row[];
  deletes: number;
} = { document: null, signers: [], users: [], actorId: 'user-employee', updateCount: 1, updates: [], created: [], deletes: 0 };

jest.mock('@/shared/database/prisma', () => {
  const signerApi = {
    findMany: jest.fn(async () => state.signers),
    createMany: jest.fn(async ({ data }: { data: Row[] }) => {
      state.created.push(...data);
      // Mirror what a real include would return, so the status() call at the end
      // of setSigners has a user to read.
      state.signers = data.map((row, index) => ({
        id: `signer-${index}`,
        status: 'PENDING',
        signedAt: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        ...row,
        user: { id: row.userId, email: `${String(row.userId)}@example.test`, employee: { fullName: String(row.userId) } },
      }));
      return { count: data.length };
    }),
    deleteMany: jest.fn(async () => { state.deletes++; return { count: state.signers.length }; }),
    updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
      state.updates.push({ where, data });
      return { count: state.updateCount };
    }),
    groupBy: jest.fn(async () => []),
  };
  const signatureApi = {
    create: jest.fn(async ({ data }: { data: Row }) => ({ id: 'signature-1', signedAt: new Date('2026-09-30T00:00:00Z'), ...data })),
  };
  const client = {
    document: { findFirst: jest.fn(async () => state.document) },
    documentSigner: signerApi,
    documentSignature: signatureApi,
    user: { findMany: jest.fn(async () => state.users) },
    // Serves both call styles: the callback form used by sign(), and the array
    // form used by setSigners().
    $transaction: jest.fn(async (arg: unknown): Promise<unknown> =>
      (typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)({ documentSigner: signerApi, documentSignature: signatureApi })
        : Promise.all(arg as Promise<unknown>[]))),
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  getCurrentUser: () => (state.actorId ? { id: state.actorId } : undefined),
}));

import { DocumentSigningService } from './document-signing.service';

const service = new DocumentSigningService();
const COMPANY = 'company-a';
const DOCUMENT = 'document-1';

const signer = (userId: string, order: number, over: Row = {}) => ({
  id: `signer-${userId}`, userId, order, status: 'PENDING', dueAt: null, signedAt: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  user: { id: userId, email: `${userId}@example.test`, employee: { fullName: userId } },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  state.document = { id: DOCUMENT, title: 'Kontrak Kerja', status: 'ACTIVE' };
  state.signers = [];
  state.users = [];
  state.actorId = 'user-employee';
  state.updateCount = 1;
  state.updates = [];
  state.created = [];
  state.deletes = 0;
});

describe('documents with no signer list', () => {
  /**
   * The decision was that order is optional. A document that never declared
   * signers must keep behaving as it did — forcing a sequence onto every
   * document would slow the simple case with no gain in certainty.
   */
  it('accepts a signature from any signed-in user', async () => {
    await expect(service.sign(COMPANY, DOCUMENT)).resolves.toMatchObject({ signatureId: 'signature-1' });
    expect(state.updates).toEqual([]);
  });

  it('reports itself as unordered and incomplete', async () => {
    await expect(service.status(COMPANY, DOCUMENT)).resolves.toMatchObject({
      ordered: false, signers: [], complete: false, currentStep: null,
    });
  });
});

describe('setting the signer list', () => {
  beforeEach(() => { state.users = [{ id: 'user-employee' }, { id: 'user-hr' }]; });

  it('stores the signers with their steps', async () => {
    await service.setSigners(COMPANY, DOCUMENT, [
      { userId: 'user-employee', order: 1 },
      { userId: 'user-hr', order: 2, dueAt: '2026-10-05T00:00:00.000Z' },
    ]);

    expect(state.created).toHaveLength(2);
    expect(state.created[1]).toMatchObject({ userId: 'user-hr', order: 2 });
    expect(state.created[1].dueAt).toEqual(new Date('2026-10-05T00:00:00.000Z'));
  });

  it('defaults everyone to one step when no order is given', async () => {
    await service.setSigners(COMPANY, DOCUMENT, [{ userId: 'user-employee' }, { userId: 'user-hr' }]);
    expect(state.created.map((row) => row.order)).toEqual([1, 1]);
  });

  it('refuses the same signer twice', async () => {
    await expect(
      service.setSigners(COMPANY, DOCUMENT, [{ userId: 'user-hr' }, { userId: 'user-hr' }]),
    ).rejects.toThrow(/more than once/i);
  });

  /** A document waiting on somebody who cannot sign waits forever. */
  it('refuses a signer who is not an active user of this company', async () => {
    state.users = [{ id: 'user-employee' }];
    await expect(
      service.setSigners(COMPANY, DOCUMENT, [{ userId: 'user-employee' }, { userId: 'user-outsider' }]),
    ).rejects.toThrow(/not active users of this company/i);
    expect(state.created).toEqual([]);
  });

  /**
   * Reshuffling a sequence after someone signed would change what that person
   * agreed to.
   */
  it('refuses to change the list once someone has signed', async () => {
    state.signers = [signer('user-employee', 1, { status: 'SIGNED' })];
    await expect(
      service.setSigners(COMPANY, DOCUMENT, [{ userId: 'user-hr' }]),
    ).rejects.toThrow(/can no longer be changed/i);
  });

  it('refuses a document outside the active company', async () => {
    state.document = null;
    await expect(service.setSigners(COMPANY, DOCUMENT, [{ userId: 'user-hr' }])).rejects.toThrow(/Document not found/i);
  });
});

describe('signing in order', () => {
  it('lets the first step sign', async () => {
    state.signers = [signer('user-employee', 1), signer('user-hr', 2)];

    await expect(service.sign(COMPANY, DOCUMENT)).resolves.toMatchObject({ signatureId: 'signature-1' });
    expect(state.updates[0].data).toMatchObject({ status: 'SIGNED' });
  });

  /** The point of a sequence: the later signer sees what the earlier agreed to. */
  it('refuses a later step while an earlier one is still pending', async () => {
    state.signers = [signer('user-employee', 1), signer('user-hr', 2)];
    state.actorId = 'user-hr';

    await expect(service.sign(COMPANY, DOCUMENT)).rejects.toThrow(/Masih menunggu 1 penanda tangan/);
  });

  it('lets the later step sign once the earlier one is done', async () => {
    state.signers = [signer('user-employee', 1, { status: 'SIGNED' }), signer('user-hr', 2)];
    state.actorId = 'user-hr';

    await expect(service.sign(COMPANY, DOCUMENT)).resolves.toMatchObject({ signatureId: 'signature-1' });
  });

  it('lets two signers in the same step sign in any order', async () => {
    state.signers = [signer('user-hr', 1), signer('user-director', 1)];
    state.actorId = 'user-director';

    await expect(service.sign(COMPANY, DOCUMENT)).resolves.toMatchObject({ signatureId: 'signature-1' });
  });

  it('refuses someone who is not on the list', async () => {
    state.signers = [signer('user-hr', 1)];
    state.actorId = 'user-stranger';

    await expect(service.sign(COMPANY, DOCUMENT)).rejects.toThrow(/not on the signer list/i);
  });

  it('refuses a second signature from the same person', async () => {
    state.signers = [signer('user-employee', 1, { status: 'SIGNED' })];
    await expect(service.sign(COMPANY, DOCUMENT)).rejects.toThrow(/already signed/i);
  });

  it('refuses when a concurrent request recorded the signature first', async () => {
    state.signers = [signer('user-employee', 1)];
    state.updateCount = 0;
    await expect(service.sign(COMPANY, DOCUMENT)).rejects.toThrow(/already recorded/i);
  });

  it('requires a signed-in user', async () => {
    state.actorId = null;
    await expect(service.sign(COMPANY, DOCUMENT)).rejects.toThrow(/signed-in user is required/i);
  });
});

describe('status and declining', () => {
  it('names whose turn it is and flags an overdue signer', async () => {
    state.signers = [
      signer('user-employee', 1, { status: 'SIGNED', signedAt: new Date('2026-09-02T00:00:00Z') }),
      signer('user-hr', 2, { dueAt: new Date('2026-01-01T00:00:00Z') }),
      signer('user-director', 3),
    ];

    const status = await service.status(COMPANY, DOCUMENT);

    expect(status.ordered).toBe(true);
    expect(status.currentStep).toBe(2);
    expect(status.signers.map((row) => row.isTurn)).toEqual([false, true, false]);
    expect(status.signers[1].overdue).toBe(true);
    expect(status.complete).toBe(false);
  });

  it('reports complete once nobody is pending', async () => {
    state.signers = [signer('user-employee', 1, { status: 'SIGNED' }), signer('user-hr', 2, { status: 'SIGNED' })];
    await expect(service.status(COMPANY, DOCUMENT)).resolves.toMatchObject({ complete: true, currentStep: null });
  });

  /** An unanswered document is worse than a refused one. */
  it('records a decline with its reason', async () => {
    await expect(service.decline(COMPANY, DOCUMENT, 'Isi kontrak belum sesuai kesepakatan')).resolves.toMatchObject({
      status: 'DECLINED',
    });
    expect(state.updates[0].data).toMatchObject({ declinedReason: 'Isi kontrak belum sesuai kesepakatan' });
  });

  it('refuses a decline when nothing is pending for that person', async () => {
    state.updateCount = 0;
    await expect(service.decline(COMPANY, DOCUMENT, 'tidak setuju')).rejects.toThrow(/no pending signature/i);
  });
});
