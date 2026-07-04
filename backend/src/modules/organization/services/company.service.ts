import { companyRepository } from '../repositories/company.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateCompanyDTO, UpdateCompanyDTO } from '../organization.dto';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('CompanyService');

export class CompanyService {
  async findAll(groupId?: string, allowedCompanyIds?: string[]) {
    return companyRepository.findAll(groupId, false, allowedCompanyIds);
  }

  async findById(id: string, allowedCompanyIds?: string[]) {
    const company = await companyRepository.findById(id, allowedCompanyIds);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    return company;
  }

  async create(dto: CreateCompanyDTO) {
    const existing = await companyRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError(`Company code "${dto.code}" already exists`);
    }

    const company = await companyRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.COMPANY_CREATED,
      aggregateId: company.id,
      aggregateType: 'Company',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    logger.info(`Company created: ${company.name} under group ${dto.groupId}`);
    return company;
  }

  async update(id: string, dto: UpdateCompanyDTO) {
    const company = await companyRepository.findById(id);
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    if (dto.code && dto.code !== company.code) {
      const existing = await companyRepository.findByCode(dto.code);
      if (existing) {
        throw new ConflictError(`Company code "${dto.code}" already exists`);
      }
    }

    const updated = await companyRepository.update(id, dto);

    await eventBus.publish({
      name: DomainEvents.COMPANY_UPDATED,
      aggregateId: id,
      aggregateType: 'Company',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return updated;
  }

  async delete(id: string) {
    const company = await companyRepository.findById(id);
    if (!company) {
      throw new NotFoundError('Company not found');
    }

    await companyRepository.softDelete(id);

    await eventBus.publish({
      name: DomainEvents.COMPANY_DELETED,
      aggregateId: id,
      aggregateType: 'Company',
      data: {},
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });
  }
}

export const companyService = new CompanyService();
