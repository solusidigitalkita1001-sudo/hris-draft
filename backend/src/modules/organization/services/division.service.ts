import { divisionRepository } from '../repositories/division.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/exceptions/AppError';
import { CreateDivisionDTO, UpdateDivisionDTO } from '../organization.dto';
import { randomUUID as uuidv4 } from 'node:crypto';
import { generateSystemCode } from '@/shared/utils/system-code';
import { assertNoActiveDependents } from '../org-integrity';

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
    // The DTO has always accepted a code; create() used to drop it without
    // telling anyone. A company that has called this division the same thing for ten
    // years keeps its own name for it.
    const requested = dto.code?.trim();
    const code = requested || await generateSystemCode({
      prefix: 'DIV',
      label: dto.name,
      exists: async (candidate) => Boolean(await divisionRepository.findByCode(dto.companyId, candidate)),
    });
    const existing = await divisionRepository.findByCode(dto.companyId, code);
    if (existing) throw new ConflictError(`Division code "${code}" already exists`);

    const division = await divisionRepository.create({ ...dto, code });

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
    const current = await this.findById(id);
    if (dto.code && dto.code !== current.code) {
      throw new ValidationError('Division code cannot be changed after creation');
    }
    if (dto.code === current.code) delete dto.code;

    return divisionRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await assertNoActiveDependents([
      { model: 'department', where: { divisionId: id }, label: 'departemen' },
    ]);
    await divisionRepository.softDelete(id);
  }
}

export const divisionService = new DivisionService();
