jest.mock('@/shared/database/prisma', () => {
  const client = {
    salaryComponent: {
      create: jest.fn(async () => ({ id: 'component-1' })),
      update: jest.fn(async () => ({ id: 'component-1' })),
      findFirst: jest.fn(async () => null),
      upsert: jest.fn(async () => ({ id: 'component-1' })),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});

import { prisma } from '@/shared/database/prisma';
import { PayrollRepository } from './payroll.repository';

const repository = new PayrollRepository();
const model = prisma.salaryComponent as unknown as {
  create: jest.Mock;
  update: jest.Mock;
  findFirst: jest.Mock;
  upsert: jest.Mock;
};

const payload = {
  companyId: 'company-1',
  code: 'TUNJ-JABATAN',
  name: 'Tunjangan Jabatan',
  type: 'ALLOWANCE',
  calculationMethod: 'FIXED',
  amount: 1_000_000,
  isTaxable: true,
  isProrated: false,
  isFixedAllowance: true,
  sortOrder: 0,
} as never;

beforeEach(() => jest.clearAllMocks());

describe('isFixedAllowance is persisted, not dropped', () => {
  // It decides whether the component enters "upah sebulan" -- the base for THR
  // (Permenaker 6/2016) and the leave-encashment daily rate. A dropped flag pays
  // a smaller THR than the law requires, silently.
  it('on create', async () => {
    await repository.createSalaryComponent(payload);

    expect(model.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isFixedAllowance: true }),
    });
  });

  it('on update', async () => {
    await repository.updateSalaryComponent('component-1', { isFixedAllowance: true } as never);

    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'component-1' },
      data: expect.objectContaining({ isFixedAllowance: true }),
    });
  });
});

describe('the uniqueness question is not the visibility question', () => {
  it('a business read hides a retired component', async () => {
    await repository.findSalaryComponentByCode('company-1', 'PPH21');

    expect(model.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'company-1', code: 'PPH21', deletedAt: null },
    });
  });

  it('the conflict check sees it, because the unique index does', async () => {
    await repository.findSalaryComponentByCodeIncludingDeleted('company-1', 'PPH21');

    const where = model.findFirst.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toEqual({ companyId: 'company-1', code: 'PPH21' });
    expect(where).not.toHaveProperty('deletedAt');
  });
});

describe('a system component the company retired is revived, not re-inserted', () => {
  it('keys on the composite unique and clears the soft delete', async () => {
    await repository.reviveOrCreateSystemSalaryComponent(payload);

    expect(model.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId_code: { companyId: 'company-1', code: 'TUNJ-JABATAN' } },
      update: { deletedAt: null, isActive: true },
    }));
    // Inserting instead would hit @@unique([companyId, code]) and take the whole
    // payroll run's transaction down with it.
    expect(model.create).not.toHaveBeenCalled();
  });
});
