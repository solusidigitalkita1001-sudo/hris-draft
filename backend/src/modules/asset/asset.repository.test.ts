jest.mock('@/shared/database/prisma');

import { prisma } from '@/shared/database/prisma';
import { assetRepository } from './asset.repository';

describe('AssetRepository employee self-service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scopes active assignments to the authenticated company and employee', async () => {
    (prisma.assetAssignment.findMany as jest.Mock).mockResolvedValue([{ id: 'assignment-1' }]);
    (prisma.assetAssignment.count as jest.Mock).mockResolvedValue(1);

    const result = await assetRepository.findMine('company-1', 'employee-1', {
      status: 'ACTIVE',
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({ items: [{ id: 'assignment-1' }], total: 1 });
    expect(prisma.assetAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyId: 'company-1',
        employeeId: 'employee-1',
        asset: { deletedAt: null },
        returnedAt: null,
      },
      skip: 10,
      take: 10,
    }));
    expect(prisma.assetAssignment.count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        employeeId: 'employee-1',
        asset: { deletedAt: null },
        returnedAt: null,
      },
    });
  });

  it('can return history without exposing financial asset fields', async () => {
    (prisma.assetAssignment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.assetAssignment.count as jest.Mock).mockResolvedValue(0);

    await assetRepository.findMine('company-1', 'employee-1', {
      status: 'ALL',
      page: 1,
      limit: 20,
    });

    const call = (prisma.assetAssignment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('returnedAt');
    expect(call.select.asset.select).toEqual({
      id: true,
      assetCode: true,
      name: true,
      serialNumber: true,
      status: true,
      branchId: true,
    });
    expect(call.select.asset.select).not.toHaveProperty('purchaseValue');
    expect(call.select.asset.select).not.toHaveProperty('currentValue');
  });
});
