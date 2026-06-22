import { groupRepository } from '../repositories/group.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateGroupDTO, UpdateGroupDTO } from '../organization.dto';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('GroupService');

export class GroupService {
  async findAll() {
    return groupRepository.findAll();
  }

  async findById(id: string) {
    const group = await groupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Company group not found');
    }
    return group;
  }

  async create(dto: CreateGroupDTO) {
    // Check unique code
    const existing = await groupRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError(`Group code "${dto.code}" already exists`);
    }

    const group = await groupRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.GROUP_CREATED,
      aggregateId: group.id,
      aggregateType: 'CompanyGroup',
      data: { ...dto },
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    logger.info(`Company group created: ${group.name} (${group.code})`);
    return group;
  }

  async update(id: string, dto: UpdateGroupDTO) {
    const group = await groupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Company group not found');
    }

    if (dto.code && dto.code !== group.code) {
      const existing = await groupRepository.findByCode(dto.code);
      if (existing) {
        throw new ConflictError(`Group code "${dto.code}" already exists`);
      }
    }

    const updated = await groupRepository.update(id, dto);

    await eventBus.publish({
      name: DomainEvents.GROUP_UPDATED,
      aggregateId: id,
      aggregateType: 'CompanyGroup',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    logger.info(`Company group updated: ${updated.name}`);
    return updated;
  }

  async delete(id: string) {
    const group = await groupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Company group not found');
    }

    await groupRepository.softDelete(id);

    await eventBus.publish({
      name: DomainEvents.GROUP_DELETED,
      aggregateId: id,
      aggregateType: 'CompanyGroup',
      data: {},
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    logger.info(`Company group deleted: ${group.name}`);
  }
}

export const groupService = new GroupService();
