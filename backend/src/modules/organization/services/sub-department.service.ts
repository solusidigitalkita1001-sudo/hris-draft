import { subDepartmentRepository } from '../repositories/sub-department.repository';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateSubDepartmentDTO, UpdateSubDepartmentDTO } from '../organization.dto';

export class SubDepartmentService {
  async findAll(departmentId: string) {
    return subDepartmentRepository.findAll(departmentId);
  }

  async findById(id: string) {
    const sub = await subDepartmentRepository.findById(id);
    if (!sub) throw new NotFoundError('Sub-department not found');
    return sub;
  }

  async create(dto: CreateSubDepartmentDTO) {
    const existing = await subDepartmentRepository.findByCode(dto.code);
    if (existing) throw new ConflictError(`Sub-department code "${dto.code}" already exists`);
    return subDepartmentRepository.create(dto);
  }

  async update(id: string, dto: UpdateSubDepartmentDTO) {
    await this.findById(id);
    if (dto.code) {
      const existing = await subDepartmentRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Sub-department code "${dto.code}" already exists`);
      }
    }
    return subDepartmentRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await subDepartmentRepository.softDelete(id);
  }
}

export const subDepartmentService = new SubDepartmentService();
