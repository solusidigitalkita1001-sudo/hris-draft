import { departmentRepository } from '../repositories/department.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateDepartmentDTO, UpdateDepartmentDTO } from '../organization.dto';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('DepartmentService');

export class DepartmentService {
  async findAll(companyId: string, divisionId?: string) {
    return departmentRepository.findAll(companyId, divisionId);
  }

  async findById(id: string) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw new NotFoundError('Department not found');
    return dept;
  }

  async create(dto: CreateDepartmentDTO) {
    const existing = await departmentRepository.findByCode(dto.code);
    if (existing) throw new ConflictError(`Department code "${dto.code}" already exists`);

    const dept = await departmentRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.DEPARTMENT_CREATED,
      aggregateId: dept.id,
      aggregateType: 'Department',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDTO) {
    await this.findById(id);

    if (dto.code) {
      const existing = await departmentRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Department code "${dto.code}" already exists`);
      }
    }

    return departmentRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await departmentRepository.softDelete(id);
  }

  async getHierarchy(companyId: string) {
    return departmentRepository.getHierarchy(companyId);
  }
}

export const departmentService = new DepartmentService();
