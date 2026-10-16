import prisma from '@/shared/database/prisma';
import { assetRepository } from './asset.repository';
import {
  AssetCategoryCreateDTO, AssetCategoryUpdateDTO, AssignAssetDTO, CreateAssetDTO,
  MyAssetsQueryDTO, ReturnAssetDTO, TransferAssetDTO, UpdateAssetDTO,
} from './asset.dto';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
import { generateSystemCode } from '@/shared/utils/system-code';

/**
 * Item exit clearance untuk aset. Onboarding men-generate item ini untuk tiap
 * resign baru, dan menolak men-CLEAR-nya selama karyawan masih memegang aset
 * (lihat onboarding.service.updateClearance). Satu konstanta supaya kedua sisi
 * tidak bisa saling meleset ejaan.
 */
export const ASSET_CLEARANCE_ITEM = 'Pengembalian aset perusahaan';

export class AssetService {
  async findMine(companyId: string, employeeId: string, query: MyAssetsQueryDTO) {
    return assetRepository.findMine(companyId, employeeId, query);
  }

  async findAll(companyId: string, status?: string) {
    return assetRepository.findAll(companyId, status);
  }

  async findById(id: string) {
    const asset = await assetRepository.findById(id);
    if (!asset) throw new NotFoundError('Asset not found');
    return asset;
  }

  /** Skema depresiasi + nilai buku aset (Business Rule Gap: 4 metode depresiasi). */
  async getDepreciation(
    id: string,
    overrides?: { method?: any; salvageValue?: number; usefulLifeYears?: number; asOfMonths?: number }
  ) {
    const result = await assetRepository.buildDepreciation(id, overrides);
    if (!result) throw new NotFoundError('Asset not found');
    return result;
  }

  async create(data: CreateAssetDTO) {
    if (data.categoryId) await this.assertCategory(data.companyId, data.categoryId);
    // Asset tags are printed on stickers before the asset is ever entered here,
    // so the code the client sends is the real one. The DTO has always accepted
    // assetCode; create() used to drop it without telling anyone.
    const requested = data.assetCode?.trim();
    const assetCode = requested || await generateSystemCode({
      prefix: 'AST',
      label: data.name,
      exists: async (candidate) => Boolean(await assetRepository.findByAssetCode(data.companyId, candidate)),
    });
    const existing = await assetRepository.findByAssetCode(data.companyId, assetCode);
    if (existing) throw new ConflictError('Asset code already exists');
    return assetRepository.create({
      ...data,
      assetCode,
    });
  }

  async update(companyId: string, id: string, data: UpdateAssetDTO) {
    const asset = await this.findById(id);
    if (data.categoryId) await this.assertCategory(companyId, data.categoryId);
    if (data.status) {
      // ASSIGNED hanya lahir dari assign/transfer dan hanya berakhir lewat
      // return — status manual tidak boleh menimpa fakta "barang ini sedang
      // di tangan orang".
      const active = await assetRepository.activeAssignment(id);
      if (active) {
        throw new ConflictError('Aset masih dipegang karyawan; kembalikan dulu sebelum mengubah statusnya');
      }
      if (asset.status === 'RETIRED' && data.status !== 'RETIRED') {
        // Sengaja boleh: RETIRED bisa dihidupkan lagi (salah klik, aset
        // diperbaiki total). Jejaknya ada di audit log.
      }
    }
    return assetRepository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);
    const active = await assetRepository.activeAssignment(id);
    if (active) {
      throw new ConflictError('Aset masih dipegang karyawan; kembalikan dulu sebelum menghapus dari register');
    }
    return assetRepository.softDelete(id);
  }

  async assign(assetId: string, data: AssignAssetDTO, userId: string) {
    const asset = await this.findById(assetId);
    if (asset.status !== 'AVAILABLE') throw new BadRequestError('Asset is not available for assignment');
    await this.assertEmployee(data.employeeId);
    return assetRepository.assign(assetId, data, userId);
  }

  async returnAsset(assetId: string, assignmentId: string, data: ReturnAssetDTO) {
    await this.findById(assetId);
    return assetRepository.returnAsset(assetId, assignmentId, data);
  }

  async transfer(companyId: string, assetId: string, data: TransferAssetDTO, userId: string) {
    const asset = await this.findById(assetId);
    if (asset.status !== 'ASSIGNED') {
      throw new ConflictError('Transfer hanya untuk aset yang sedang dipegang; pakai assign untuk aset AVAILABLE');
    }
    await this.assertEmployee(data.toEmployeeId);
    return assetRepository.transfer(assetId, companyId, data, userId);
  }

  /**
   * Aset yang masih dipegang karyawan, dengan nilai buku saat ini — bahan exit
   * clearance dan dasar beban aset hilang di final payroll.
   */
  async outstandingFor(companyId: string, employeeId: string) {
    const rows = await assetRepository.outstandingFor(companyId, employeeId);
    // ponytail: satu query depresiasi per aset; daftar aset satu orang kecil.
    return Promise.all(rows.map(async (row) => ({
      ...row,
      currentBookValue: (await assetRepository.buildDepreciation(row.asset.id))?.currentBookValue ?? null,
    })));
  }

  /** Jumlah aset yang masih dipegang — gerbang exit clearance. */
  async countOutstanding(employeeId: string) {
    return prisma.assetAssignment.count({
      where: { employeeId, returnedAt: null, asset: { deletedAt: null } },
    });
  }

  // ==================== Categories ====================
  async listCategories(companyId: string) {
    return assetRepository.findCategories(companyId);
  }

  async createCategory(companyId: string, data: AssetCategoryCreateDTO) {
    return assetRepository.createCategory(companyId, data);
  }

  async updateCategory(companyId: string, id: string, data: AssetCategoryUpdateDTO) {
    await this.assertCategory(companyId, id);
    return assetRepository.updateCategory(id, data);
  }

  async deleteCategory(companyId: string, id: string) {
    await this.assertCategory(companyId, id);
    const used = await assetRepository.countAssetsInCategory(companyId, id);
    if (used > 0) {
      throw new ConflictError(`Kategori masih dipakai ${used} aset; pindahkan dulu aset-asetnya`);
    }
    return assetRepository.deleteCategory(id);
  }

  private async assertCategory(companyId: string, categoryId: string) {
    const category = await assetRepository.findCategoryById(companyId, categoryId);
    if (!category) throw new NotFoundError('Kategori aset tidak ditemukan di perusahaan ini');
    return category;
  }

  // Tenant middleware pins companyId but trusts the client employeeId; validate
  // it belongs to this company (Employee is scoped, so a foreign employee
  // resolves to null) to avoid attaching another tenant's PII.
  private async assertEmployee(employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError('Employee not found');
  }
}

export const assetService = new AssetService();
