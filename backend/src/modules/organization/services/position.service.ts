import { positionRepository } from '../repositories/position.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreatePositionDTO, UpdatePositionDTO } from '../organization.dto';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('PositionService');

export class PositionService {
  async findAll(companyId: string, departmentId?: string) {
    return positionRepository.findAll(companyId, departmentId);
  }

  async findById(id: string) {
    const position = await positionRepository.findById(id);
    if (!position) throw new NotFoundError('Position not found');
    return position;
  }

  async create(dto: CreatePositionDTO) {
    const existing = await positionRepository.findByCode(dto.code);
    if (existing) throw new ConflictError(`Position code "${dto.code}" already exists`);

    const position = await positionRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.POSITION_CREATED,
      aggregateId: position.id,
      aggregateType: 'Position',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return position;
  }

  async update(id: string, dto: UpdatePositionDTO) {
    await this.findById(id);

    if (dto.code) {
      const existing = await positionRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Position code "${dto.code}" already exists`);
      }
    }

    return positionRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await positionRepository.softDelete(id);
  }
}

export const positionService = new PositionService();
