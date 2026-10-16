/**
 * Aturan pendalaman modul aset: hapus/ubah-status terkunci selama aset
 * dipegang, transfer atomik dan bersyarat, kategori tak bisa dihapus selagi
 * dipakai, dan clearance resign tak bisa CLEARED selagi karyawan memegang
 * aset.
 */
type Row = Record<string, unknown>;

const state: {
  asset: Row | null;
  activeAssignment: Row | null;
  category: Row | null;
  categoryUsage: number;
  outstanding: number;
  clearance: Row | null;
  txClosed: { count: number };
  created: Row[];
  updated: Array<{ where: Row; data: Row }>;
} = {
  asset: null, activeAssignment: null, category: null, categoryUsage: 0,
  outstanding: 0, clearance: null, txClosed: { count: 1 }, created: [], updated: [],
};

const tx = {
  assetAssignment: {
    findFirst: jest.fn(async () => state.activeAssignment),
    updateMany: jest.fn(async () => state.txClosed),
    create: jest.fn(async ({ data }: { data: Row }) => { state.created.push(data); return { id: 'assignment-baru', ...data }; }),
  },
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    asset: {
      findFirst: jest.fn(async () => state.asset),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => { state.updated.push({ where, data }); return { ...where, ...data }; }),
      count: jest.fn(async () => state.categoryUsage),
      create: jest.fn(async ({ data }: { data: Row }) => ({ id: 'asset-baru', ...data })),
    },
    assetAssignment: {
      findFirst: jest.fn(async () => state.activeAssignment),
      count: jest.fn(async () => state.outstanding),
      findMany: jest.fn(async () => []),
    },
    assetCategory: {
      findFirst: jest.fn(async () => state.category),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Row }) => ({ id: 'kategori-baru', ...data })),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => ({ ...where, ...data })),
      delete: jest.fn(async ({ where }: { where: Row }) => where),
    },
    employee: { findFirst: jest.fn(async () => ({ id: 'employee-tujuan' })) },
    exitClearance: {
      findUnique: jest.fn(async () => state.clearance),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => ({ ...where, ...data })),
    },
    resignation: { findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));

import { assetService, ASSET_CLEARANCE_ITEM } from './asset.service';

const COMPANY = 'company-a';

beforeEach(() => {
  jest.clearAllMocks();
  state.asset = { id: 'asset-1', status: 'ASSIGNED', assignments: [] };
  state.activeAssignment = { id: 'assignment-1', employeeId: 'employee-lama' };
  state.category = { id: 'kategori-1', companyId: COMPANY };
  state.categoryUsage = 0;
  state.outstanding = 0;
  state.clearance = null;
  state.txClosed = { count: 1 };
  state.created = [];
  state.updated = [];
});

describe('hapus & ubah status terkunci selama dipegang', () => {
  it('refuses delete while an assignment is active', async () => {
    await expect(assetService.delete('asset-1')).rejects.toThrow(/masih dipegang/);
    expect(state.updated).toHaveLength(0);
  });

  it('soft-deletes once nothing is held', async () => {
    state.activeAssignment = null;
    await assetService.delete('asset-1');
    expect(state.updated[0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('refuses a manual status change while assigned', async () => {
    await expect(assetService.update(COMPANY, 'asset-1', { status: 'MAINTENANCE' }))
      .rejects.toThrow(/masih dipegang/);
  });

  it('lets MAINTENANCE go back to AVAILABLE when free', async () => {
    state.asset = { id: 'asset-1', status: 'MAINTENANCE' };
    state.activeAssignment = null;
    await assetService.update(COMPANY, 'asset-1', { status: 'AVAILABLE' });
    expect(state.updated[0].data.status).toBe('AVAILABLE');
  });
});

describe('transfer antar karyawan', () => {
  it('refuses transfer of an asset nobody holds', async () => {
    state.asset = { id: 'asset-1', status: 'AVAILABLE' };
    await expect(assetService.transfer(COMPANY, 'asset-1', { toEmployeeId: 'employee-tujuan', condition: 'GOOD' }, 'user-ga'))
      .rejects.toThrow(/pakai assign/);
  });

  it('refuses transfer to the current holder', async () => {
    state.activeAssignment = { id: 'assignment-1', employeeId: 'employee-tujuan' };
    await expect(assetService.transfer(COMPANY, 'asset-1', { toEmployeeId: 'employee-tujuan', condition: 'GOOD' }, 'user-ga'))
      .rejects.toThrow(/sudah dipegang/);
  });

  it('closes the old assignment and opens the new one in the same transaction', async () => {
    const result = await assetService.transfer(COMPANY, 'asset-1', { toEmployeeId: 'employee-tujuan', condition: 'FAIR' }, 'user-ga');
    expect(tx.assetAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'assignment-1', returnedAt: null },
    }));
    expect(state.created[0]).toMatchObject({ employeeId: 'employee-tujuan', conditionAtAssign: 'FAIR', companyId: COMPANY });
    expect(result).toMatchObject({ employeeId: 'employee-tujuan' });
  });

  it('fails whole when the old assignment was closed by a race', async () => {
    state.txClosed = { count: 0 };
    await expect(assetService.transfer(COMPANY, 'asset-1', { toEmployeeId: 'employee-tujuan', condition: 'GOOD' }, 'user-ga'))
      .rejects.toThrow(/berubah saat transfer/);
    expect(state.created).toHaveLength(0);
  });
});

describe('kategori', () => {
  it('refuses deleting a category still used by assets', async () => {
    state.categoryUsage = 3;
    await expect(assetService.deleteCategory(COMPANY, 'kategori-1')).rejects.toThrow(/dipakai 3 aset/);
  });

  it('refuses a category from another company on update', async () => {
    state.category = null;
    await expect(assetService.updateCategory(COMPANY, 'kategori-asing', { name: 'Baru' }))
      .rejects.toThrow(/tidak ditemukan/);
  });
});

describe('clearance resign', () => {
  // Import di sini supaya mock prisma yang sama dipakai modul onboarding.
  it('refuses CLEARED on the asset item while assets are outstanding', async () => {
    const { onboardingService } = await import('@/modules/onboarding/onboarding.service');
    state.clearance = { checklistItem: ASSET_CLEARANCE_ITEM, resignation: { employeeId: 'employee-resign' } };
    state.outstanding = 2;
    await expect(onboardingService.updateClearance('clearance-1', 'CLEARED'))
      .rejects.toThrow(/masih memegang 2 aset/);
  });

  it('clears the asset item once everything is returned', async () => {
    const { onboardingService } = await import('@/modules/onboarding/onboarding.service');
    state.clearance = { checklistItem: ASSET_CLEARANCE_ITEM, resignation: { employeeId: 'employee-resign' } };
    state.outstanding = 0;
    await expect(onboardingService.updateClearance('clearance-1', 'CLEARED')).resolves.toBeDefined();
  });

  it('leaves non-asset items alone', async () => {
    const { onboardingService } = await import('@/modules/onboarding/onboarding.service');
    state.clearance = { checklistItem: 'Exit interview', resignation: { employeeId: 'employee-resign' } };
    state.outstanding = 5;
    await expect(onboardingService.updateClearance('clearance-1', 'CLEARED')).resolves.toBeDefined();
  });
});
