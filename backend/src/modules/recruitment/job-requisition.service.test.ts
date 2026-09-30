import { JobRequisitionStatus } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  setting: { value: string } | null;
  requisition: Row | null;
  department: Row | null;
  position: Row | null;
  duplicate: Row | null;
  actorId: string | null;
  updateCount: number;
  created: Row[];
  updates: Array<{ where: Row; data: Row }>;
} = {
  setting: null, requisition: null, department: { id: 'dept-1' }, position: { id: 'position-1' },
  duplicate: null, actorId: 'user-hr', updateCount: 1, created: [], updates: [],
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    companySetting: { findUnique: jest.fn(async () => state.setting) },
    department: { findFirst: jest.fn(async () => state.department) },
    position: { findFirst: jest.fn(async () => state.position) },
    jobRequisition: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => (where.code ? state.duplicate : state.requisition)),
      findFirstOrThrow: jest.fn(async () => ({ id: 'req-1', code: 'REQ-1', status: 'APPROVED', headcount: 2 })),
      findMany: jest.fn(async () => (state.requisition ? [state.requisition] : [])),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'req-1', status: JobRequisitionStatus.DRAFT, ...data };
        state.created.push(row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { count: state.updateCount };
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => (state.actorId ? { id: state.actorId } : undefined) }));

import { JobRequisitionService } from './job-requisition.service';

const service = new JobRequisitionService();
const COMPANY = 'company-a';

const validInput = {
  code: 'REQ-2026-001',
  title: 'Senior Engineer',
  headcount: 2,
  reason: 'Penggantian dua engineer yang resign bulan lalu.',
};

beforeEach(() => {
  jest.clearAllMocks();
  state.setting = null;
  state.requisition = null;
  state.department = { id: 'dept-1' };
  state.position = { id: 'position-1' };
  state.duplicate = null;
  state.actorId = 'user-hr';
  state.updateCount = 1;
  state.created = [];
  state.updates = [];
});

/**
 * The decision: build the requisition, and let a per-company setting decide
 * whether a vacancy must have one. A company with a central headcount budget
 * gets the control it pays for; a company without one should not gain a
 * mandatory extra step for every replacement hire.
 */
describe('whether a requisition is required', () => {
  it('is not required by default', async () => {
    await expect(service.isRequired(COMPANY)).resolves.toBe(false);
  });

  it('is required once the company switches it on', async () => {
    state.setting = { value: 'true' };
    await expect(service.isRequired(COMPANY)).resolves.toBe(true);
  });

  it.each([['false'], ['TRUE'], ['1'], ['']])('treats %p as not required', async (value) => {
    state.setting = { value };
    await expect(service.isRequired(COMPANY)).resolves.toBe(false);
  });
});

describe('gating a job posting', () => {
  it('lets a posting through with no requisition when none is required', async () => {
    await expect(service.resolveForPosting(COMPANY, undefined, 1)).resolves.toBeNull();
  });

  it('refuses a posting with no requisition when the company requires one', async () => {
    state.setting = { value: 'true' };
    await expect(service.resolveForPosting(COMPANY, undefined, 1))
      .rejects.toThrow(/mewajibkan requisition yang sudah disetujui/i);
  });

  it('accepts an approved requisition with headcount to spare', async () => {
    state.requisition = { id: 'req-1', status: 'APPROVED', headcount: 3, postings: [{ vacancies: 1 }] };
    await expect(service.resolveForPosting(COMPANY, 'req-1', 1)).resolves.toMatchObject({ id: 'req-1', fulfils: false });
  });

  it('reports the requisition as fulfilled when the last head is opened', async () => {
    state.requisition = { id: 'req-1', status: 'APPROVED', headcount: 2, postings: [{ vacancies: 1 }] };
    await expect(service.resolveForPosting(COMPANY, 'req-1', 1)).resolves.toMatchObject({ fulfils: true });
  });

  /**
   * Without this the approval is a formality: any number of postings could be
   * opened against one approved head.
   */
  it('refuses vacancies beyond the headcount that was granted', async () => {
    state.requisition = { id: 'req-1', status: 'APPROVED', headcount: 2, postings: [{ vacancies: 2 }] };
    await expect(service.resolveForPosting(COMPANY, 'req-1', 1))
      .rejects.toThrow(/hanya menyetujui 2 headcount; 2 sudah dibuka/);
  });

  it.each([['DRAFT'], ['SUBMITTED'], ['REJECTED'], ['CANCELLED'], ['FULFILLED']])(
    'refuses a %s requisition',
    async (status) => {
      state.requisition = { id: 'req-1', status, headcount: 5, postings: [] };
      await expect(service.resolveForPosting(COMPANY, 'req-1', 1)).rejects.toThrow(/must be APPROVED/i);
    },
  );

  it('refuses a requisition from another company', async () => {
    state.requisition = null;
    await expect(service.resolveForPosting(COMPANY, 'req-elsewhere', 1))
      .rejects.toThrow(/not found in the active company/i);
  });
});

describe('creating a requisition', () => {
  it('stores it as a draft with its reason and budget', async () => {
    await service.create(COMPANY, { ...validInput, budgetPerHire: 20_000_000, departmentId: 'dept-1' });

    expect(state.created[0]).toMatchObject({
      code: 'REQ-2026-001', headcount: 2, status: JobRequisitionStatus.DRAFT, requestedBy: 'user-hr',
    });
    expect(String(state.created[0].budgetPerHire)).toBe('20000000');
  });

  it.each([[0], [-1], [1.5]])('refuses headcount %p', async (headcount) => {
    await expect(service.create(COMPANY, { ...validInput, headcount })).rejects.toThrow(/positive whole number/i);
  });

  it('refuses a department from another company', async () => {
    state.department = null;
    await expect(service.create(COMPANY, { ...validInput, departmentId: 'dept-elsewhere' }))
      .rejects.toThrow(/departmentId does not belong/i);
  });

  it('refuses a duplicate code', async () => {
    state.duplicate = { id: 'req-existing' };
    await expect(service.create(COMPANY, validInput)).rejects.toThrow(/already exists/i);
  });
});

describe('deciding a requisition', () => {
  beforeEach(() => {
    state.requisition = { id: 'req-1', status: JobRequisitionStatus.SUBMITTED, requestedBy: 'user-manager' };
  });

  it('approves a submitted requisition', async () => {
    await service.approve(COMPANY, 'req-1');
    expect(state.updates[0].where).toMatchObject({ status: JobRequisitionStatus.SUBMITTED });
    expect(state.updates[0].data).toMatchObject({ status: JobRequisitionStatus.APPROVED, approvedBy: 'user-hr' });
  });

  /** Headcount is budget: the person asking for a head does not grant it. */
  it('refuses when the approver is the requester', async () => {
    state.actorId = 'user-manager';
    await expect(service.approve(COMPANY, 'req-1')).rejects.toThrow(/cannot approve their own/i);
  });

  it('refuses to approve something that is not submitted', async () => {
    state.requisition = { id: 'req-1', status: JobRequisitionStatus.DRAFT, requestedBy: 'user-manager' };
    await expect(service.approve(COMPANY, 'req-1')).rejects.toThrow(/must be SUBMITTED/i);
  });

  it('refuses when someone else decided it a moment ago', async () => {
    state.updateCount = 0;
    await expect(service.approve(COMPANY, 'req-1')).rejects.toThrow(/decided by someone else/i);
  });

  it('records a rejection reason', async () => {
    await service.reject(COMPANY, 'req-1', 'Anggaran headcount tahun ini sudah habis');
    expect(state.updates[0].data).toMatchObject({
      status: JobRequisitionStatus.REJECTED, rejectedReason: 'Anggaran headcount tahun ini sudah habis',
    });
  });

  it('submits a draft', async () => {
    state.requisition = { id: 'req-1', status: JobRequisitionStatus.DRAFT };
    await service.submit(COMPANY, 'req-1');
    expect(state.updates[0].data).toMatchObject({ status: JobRequisitionStatus.SUBMITTED });
  });

  it.each([['FULFILLED'], ['REJECTED'], ['CANCELLED']])('refuses to cancel a %s requisition', async (status) => {
    state.requisition = { id: 'req-1', status };
    await expect(service.cancel(COMPANY, 'req-1')).rejects.toThrow(/cannot be cancelled/i);
  });

  it('cancels an approved requisition that is no longer needed', async () => {
    state.requisition = { id: 'req-1', status: JobRequisitionStatus.APPROVED };
    await expect(service.cancel(COMPANY, 'req-1')).resolves.toMatchObject({ status: JobRequisitionStatus.CANCELLED });
  });
});
