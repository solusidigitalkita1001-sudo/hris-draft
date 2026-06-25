import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateAssetDTO, AssignAssetDTO, ReturnAssetDTO } from './asset.dto';

export class AssetRepository {
  async findAll(companyId: string, status?: string) {
    const where: Prisma.AssetWhereInput = { companyId, deletedAt: null };
    if (status) where.status = status as any;
    return prisma.asset.findMany({
      where,
      include: {
        assignments: { where: { returnedAt: null }, include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignments: { include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } }, orderBy: { assignedAt: 'desc' } },
      },
    });
  }

  async create(data: CreateAssetDTO) {
    return prisma.asset.create({ data: { ...data, purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined, purchaseValue: data.purchaseValue, currentValue: data.purchaseValue } });
  }

  async update(id: string, data: Partial<CreateAssetDTO>) {
    return prisma.asset.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async assign(assetId: string, data: AssignAssetDTO, userId: string) {
    await prisma.asset.update({ where: { id: assetId }, data: { status: 'ASSIGNED' } });
    return prisma.assetAssignment.create({
      data: { assetId, employeeId: data.employeeId, conditionAtAssign: data.conditionAtAssign, notes: data.notes, createdBy: userId },
      include: { employee: { select: { id: true, fullName: true } } },
    });
  }

  async returnAsset(assetId: string, assignmentId: string, data: ReturnAssetDTO) {
    await prisma.assetAssignment.update({
      where: { id: assignmentId },
      data: { returnedAt: new Date(), conditionAtReturn: data.conditionAtReturn, notes: data.notes },
    });
    const status = data.conditionAtReturn === 'DAMAGED' || data.conditionAtReturn === 'LOST' ? 'MAINTENANCE' : 'AVAILABLE';
    return prisma.asset.update({ where: { id: assetId }, data: { status } });
  }
}

export const assetRepository = new AssetRepository();
