import { assetRepository } from './asset.repository';
import { CreateAssetDTO, AssignAssetDTO, ReturnAssetDTO } from './asset.dto';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { generateSystemCode } from '@/shared/utils/system-code';

export class AssetService {
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
    const assetCode = await generateSystemCode({
      prefix: 'AST',
      label: data.name,
      exists: async (candidate) => Boolean(await assetRepository.findByAssetCode(candidate)),
    });
    const existing = await assetRepository.findByAssetCode(assetCode);
    if (existing) throw new ConflictError('Asset code already exists');
    return assetRepository.create({
      ...data,
      assetCode,
    });
  }

  async assign(assetId: string, data: AssignAssetDTO, userId: string) {
    const asset = await this.findById(assetId);
    if (asset.status !== 'AVAILABLE') throw new BadRequestError('Asset is not available for assignment');
    return assetRepository.assign(assetId, data, userId);
  }

  async returnAsset(assetId: string, assignmentId: string, data: ReturnAssetDTO) {
    await this.findById(assetId);
    return assetRepository.returnAsset(assetId, assignmentId, data);
  }
}

export const assetService = new AssetService();
