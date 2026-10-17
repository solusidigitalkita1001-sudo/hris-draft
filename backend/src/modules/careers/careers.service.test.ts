type Row = Record<string, unknown>;

const state: {
  company: Row | null;
  setting: Row | null;
  posting: Row | null;
  candidate: Row | null;
  application: Row | null;
  created: Array<{ model: string; data: Row }>;
} = { company: null, setting: null, posting: null, candidate: null, application: null, created: [] };

jest.mock('@/shared/database/prisma', () => {
  const client: Record<string, unknown> = {
    company: { findFirst: jest.fn(async () => state.company) },
    companySetting: { findUnique: jest.fn(async () => state.setting) },
    jobPosting: { findFirst: jest.fn(async () => state.posting), findMany: jest.fn(async () => []) },
    candidate: {
      findFirst: jest.fn(async () => state.candidate),
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push({ model: 'candidate', data });
        return { id: 'candidate-new' };
      }),
    },
    jobApplication: {
      findFirst: jest.fn(async () => state.application),
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push({ model: 'application', data });
        return { id: 'application-new', appliedAt: new Date('2026-10-11T00:00:00Z') };
      }),
    },
  };
  client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  runInSystemContext: async (_reason: string, fn: () => unknown) => fn(),
}));

import { careersService } from './careers.service';

const APPLY = {
  firstName: 'Dina', lastName: 'Pelamar', email: 'Dina@Example.com',
  coverLetter: 'Saya tertarik dengan posisi ini karena pengalaman saya relevan.',
};

beforeEach(() => {
  jest.clearAllMocks();
  state.company = { id: 'company-a', name: 'PT Synthetic' };
  state.setting = { value: 'true' };
  state.posting = { id: 'posting-1', title: 'Backend Engineer' };
  state.candidate = null;
  state.application = null;
  state.created = [];
});

describe('the page only exists for tenants who turned it on', () => {
  it('404s an unknown company code and a disabled page identically', async () => {
    state.company = null;
    await expect(careersService.listPostings('tidak-ada')).rejects.toThrow(/tidak ditemukan/i);

    state.company = { id: 'company-a', name: 'PT Synthetic' };
    state.setting = { value: 'false' };
    await expect(careersService.listPostings('company-a')).rejects.toThrow(/tidak ditemukan/i);

    state.setting = null;
    await expect(careersService.listPostings('company-a')).rejects.toThrow(/tidak ditemukan/i);
  });
});

describe('applying', () => {
  it('creates candidate (lowercased email, source CAREER_PAGE) and the application', async () => {
    const receipt = await careersService.apply('company-a', 'ENG-01', APPLY as never);

    const candidate = state.created.find((row) => row.model === 'candidate');
    expect(candidate?.data).toMatchObject({ companyId: 'company-a', email: 'dina@example.com', source: 'CAREER_PAGE' });
    const application = state.created.find((row) => row.model === 'application');
    expect(application?.data).toMatchObject({ companyId: 'company-a', jobPostingId: 'posting-1', candidateId: 'candidate-new' });
    // Tanda terima tidak membocorkan id internal.
    expect(receipt).toEqual({ received: true, position: 'Backend Engineer', appliedAt: expect.any(Date) });
  });

  it('reuses the returning candidate instead of duplicating the person', async () => {
    state.candidate = { id: 'candidate-existing' };
    await careersService.apply('company-a', 'ENG-01', APPLY as never);
    expect(state.created.find((row) => row.model === 'candidate')).toBeUndefined();
    expect(state.created.find((row) => row.model === 'application')?.data).toMatchObject({ candidateId: 'candidate-existing' });
  });

  it('refuses a second application to the same posting', async () => {
    state.candidate = { id: 'candidate-existing' };
    state.application = { id: 'application-existing' };
    await expect(careersService.apply('company-a', 'ENG-01', APPLY as never))
      .rejects.toThrow(/sudah pernah dikirim/);
  });

  it('404s a posting that is not published', async () => {
    state.posting = null;
    await expect(careersService.apply('company-a', 'ENG-01', APPLY as never)).rejects.toThrow(/tidak ditemukan/i);
  });
});
