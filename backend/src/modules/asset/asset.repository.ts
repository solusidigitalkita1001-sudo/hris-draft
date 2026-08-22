import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@/shared/exceptions/AppError';
import { CreateAssetDTO, AssignAssetDTO, ReturnAssetDTO } from './asset.dto';
import {
  generateDepreciationSchedule,
  bookValueAfterMonths,
  DepreciationMethod,
} from '@/shared/asset/depreciation';

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

  /**
   * Hitung skema depresiasi & nilai buku aset. Metode + umur ekonomis diambil dari
   * AssetCategory (fallback ke override query). asOfMonths → nilai buku untuk beban aset
   * hilang saat resign. Read-only (tidak persist).
   */
  async buildDepreciation(
    id: string,
    overrides?: {
      method?: DepreciationMethod;
      salvageValue?: number;
      usefulLifeYears?: number;
      asOfMonths?: number;
    }
  ) {
    const asset = await prisma.asset.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, assetCode: true, purchaseValue: true, purchaseDate: true, categoryId: true },
    });
    if (!asset) return null;

    const category = asset.categoryId
      ? await prisma.assetCategory.findUnique({
          where: { id: asset.categoryId },
          select: { depreciationMethod: true, usefulLifeMonths: true },
        })
      : null;

    const method = (overrides?.method ??
      (category?.depreciationMethod as DepreciationMethod) ??
      'STRAIGHT_LINE') as DepreciationMethod;
    const usefulLifeYears =
      overrides?.usefulLifeYears ??
      (category?.usefulLifeMonths ? category.usefulLifeMonths / 12 : 4);
    const purchaseValue = Number(asset.purchaseValue ?? 0);
    const salvageValue = overrides?.salvageValue ?? 0;

    const schedule = generateDepreciationSchedule({ purchaseValue, salvageValue, usefulLifeYears, method });

    // Nilai buku saat ini berdasarkan umur aktual sejak pembelian (atau override asOfMonths).
    let asOfMonths = overrides?.asOfMonths;
    if (asOfMonths === undefined && asset.purchaseDate) {
      const now = new Date();
      asOfMonths =
        (now.getUTCFullYear() - asset.purchaseDate.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - asset.purchaseDate.getUTCMonth());
    }
    const currentBookValue =
      asOfMonths === undefined
        ? purchaseValue
        : bookValueAfterMonths({ purchaseValue, salvageValue, usefulLifeYears, method, asOfMonths });

    return {
      assetId: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      method,
      purchaseValue,
      salvageValue,
      usefulLifeYears,
      asOfMonths: asOfMonths ?? null,
      currentBookValue,
      schedule,
    };
  }

  async findByAssetCode(assetCode: string) {
    return prisma.asset.findUnique({
      where: { assetCode },
    });
  }

  async create(data: CreateAssetDTO & { assetCode: string }) {
    return prisma.asset.create({ data: { ...data, purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined, purchaseValue: data.purchaseValue, currentValue: data.purchaseValue } });
  }

  async update(id: string, data: Partial<CreateAssetDTO>) {
    return prisma.asset.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async assign(assetId: string, data: AssignAssetDTO, userId: string) {
    const parentAsset = await prisma.asset.findFirst({ where: { id: assetId }, select: { companyId: true } });
    if (!parentAsset) throw new NotFoundError('Asset not found');
    await prisma.asset.update({ where: { id: assetId }, data: { status: 'ASSIGNED' } });
    return prisma.assetAssignment.create({
      data: { assetId, employeeId: data.employeeId, conditionAtAssign: data.conditionAtAssign, notes: data.notes, createdBy: userId, companyId: parentAsset.companyId },
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
