import { assetRepository } from './asset.repository';
import { CreateAssetDTO, AssignAssetDTO, ReturnAssetDTO } from './asset.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

export class AssetService {
  async findAll(companyId: string, status?: string) {
    return assetRepository.findAll(companyId, status);
  }

  async findById(id: string) {
    const asset = await assetRepository.findById(id);
    if (!asset) throw new NotFoundError('Asset not found');
    return asset;
  }

  async create(data: CreateAssetDTO) {
    return assetRepository.create(data);
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
