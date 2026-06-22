import { divisionRepository } from '../repositories/division.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateDivisionDTO, UpdateDivisionDTO } from '../organization.dto';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('DivisionService');

export class DivisionService {
  async findAll(companyId: string) {
    return divisionRepository.findAll(companyId);
  }

  async findById(id: string) {
    const division = await divisionRepository.findById(id);
    if (!division) throw new NotFoundError('Division not found');
    return division;
  }

  async create(dto: CreateDivisionDTO) {
    const existing = await divisionRepository.findByCode(dto.code);
    if (existing) throw new ConflictError(`Division code "${dto.code}" already exists`);

    const division = await divisionRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.DIVISION_CREATED,
      aggregateId: division.id,
      aggregateType: 'Division',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return division;
  }

  async update(id: string, dto: UpdateDivisionDTO) {
    await this.findById(id);

    if (dto.code) {
      const existing = await divisionRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Division code "${dto.code}" already exists`);
      }
    }

    return divisionRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await divisionRepository.softDelete(id);
  }
}

export const divisionService = new DivisionService();
