import { branchRepository } from '../repositories/branch.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateBranchDTO, UpdateBranchDTO } from '../organization.dto';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('BranchService');

export class BranchService {
  async findAll(companyId: string) {
    return branchRepository.findAll(companyId);
  }

  async findById(id: string) {
    const branch = await branchRepository.findById(id);
    if (!branch) throw new NotFoundError('Branch not found');
    return branch;
  }

  async create(dto: CreateBranchDTO) {
    const existing = await branchRepository.findByCode(dto.code);
    if (existing) throw new ConflictError(`Branch code "${dto.code}" already exists`);

    const branch = await branchRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.BRANCH_CREATED,
      aggregateId: branch.id,
      aggregateType: 'Branch',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    logger.info(`Branch created: ${branch.name}`);
    return branch;
  }

  async update(id: string, dto: UpdateBranchDTO) {
    await this.findById(id);

    if (dto.code) {
      const existing = await branchRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Branch code "${dto.code}" already exists`);
      }
    }

    const updated = await branchRepository.update(id, dto);

    await eventBus.publish({
      name: DomainEvents.BRANCH_UPDATED,
      aggregateId: id,
      aggregateType: 'Branch',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await branchRepository.softDelete(id);
  }
}

export const branchService = new BranchService();
