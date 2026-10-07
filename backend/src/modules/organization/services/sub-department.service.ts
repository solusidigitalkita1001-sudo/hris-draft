import { subDepartmentRepository } from '../repositories/sub-department.repository';
import { departmentRepository } from '../repositories/department.repository';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/exceptions/AppError';
import { CreateSubDepartmentDTO, UpdateSubDepartmentDTO } from '../organization.dto';
import { generateSystemCode } from '@/shared/utils/system-code';

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
    // A sub-department has no companyId of its own in the DTO -- it inherits one
    // from its parent department, which repository.create() resolves. The code
    // check needs that company before the row exists, so resolve it here too.
    const parent = await departmentRepository.findById(dto.departmentId);
    if (!parent) throw new NotFoundError('Parent department not found or out of scope');

    // The DTO has always accepted a code; create() used to drop it without
    // telling anyone. A company that has called this sub-department the same
    // thing for ten years keeps its own name for it.
    const requested = dto.code?.trim();
    const code = requested || await generateSystemCode({
      prefix: 'SUBDPT',
      label: dto.name,
      exists: async (candidate) => Boolean(await subDepartmentRepository.findByCode(parent.companyId, candidate)),
    });
    const existing = await subDepartmentRepository.findByCode(parent.companyId, code);
    if (existing) throw new ConflictError(`Sub-department code "${code}" already exists`);
    const created = await subDepartmentRepository.create({ ...dto, code });
    if (!created) throw new NotFoundError('Parent department not found or out of scope');
    return created;
  }

  async update(id: string, dto: UpdateSubDepartmentDTO) {
    const current = await this.findById(id);
    if (dto.code && dto.code !== current.code) {
      throw new ValidationError('Sub-department code cannot be changed after creation');
    }
    if (dto.code === current.code) delete dto.code;
    return subDepartmentRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await subDepartmentRepository.softDelete(id);
  }
}

export const subDepartmentService = new SubDepartmentService();
