import { userRepository } from './user.repository';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import {
  CreateUserDTO,
  UpdateUserDTO,
  CreateUserCompanyAccessDTO,
  UpdateUserCompanyAccessDTO,
} from './user.dto';
import { authRepository } from '../auth/auth.repository';
import {
  assertCompanyAccessAuthority,
  assertEmployeeWithinScope,
  assertUserWithinScope,
  requesterCompanyIds,
} from './user-access-guard';
import { ForbiddenError } from '@/shared/exceptions/AppError';

const logger = new WinstonLogger('UserService');

export class UserService {
  async findAll(page: number, limit: number, filters?: { companyId?: string; search?: string }) {
    const allowed = requesterCompanyIds();
    if (allowed !== null && filters?.companyId && !allowed.includes(filters.companyId)) {
      throw new ForbiddenError('Cannot list users outside your company scope');
    }
    return userRepository.findAll(page, limit, filters, allowed ?? undefined);
  }

  async findById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    assertUserWithinScope(user);
    return user;
  }

  async create(dto: CreateUserDTO) {
    // Check email uniqueness
    const existing = await authRepository.findUserByEmail(dto.email);
    if (existing) throw new ConflictError('Email already registered');

    // Validate and hash password
    passwordHandler.validate(dto.password);
    const passwordHash = await passwordHandler.hash(dto.password);

    const createData: any = {
      email: dto.email.toLowerCase(),
      passwordHash,
    };
    if (dto.employeeId) {
      await assertEmployeeWithinScope(dto.employeeId);
      createData.employee = { connect: { id: dto.employeeId } };
    }
    const user = await userRepository.create(createData);

    logger.info(`User created: ${user.email}`);
    return user;
  }

  async update(id: string, dto: UpdateUserDTO) {
    await this.findById(id);

    if (dto.email) {
      const existing = await authRepository.findUserByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('Email already registered');
      }
    }

    const updateData: any = {
      ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };

    if (dto.employeeId !== undefined) {
      if (dto.employeeId) await assertEmployeeWithinScope(dto.employeeId);
      updateData.employee = dto.employeeId
        ? { connect: { id: dto.employeeId } }
        : { disconnect: true };
    }

    return userRepository.update(id, updateData);
  }

  async delete(id: string) {
    await this.findById(id);
    await userRepository.softDelete(id);
    logger.info(`User soft deleted: ${id}`);
  }

  async findCompanyAccesses(userId: string) {
    await this.findById(userId);
    return userRepository.findCompanyAccesses(userId);
  }

  async createCompanyAccess(userId: string, dto: CreateUserCompanyAccessDTO) {
    await this.findById(userId);
    assertCompanyAccessAuthority(dto.companyId, { groupId: dto.groupId, accessScope: dto.accessScope });

    const existing = await userRepository.findCompanyAccessByUserAndCompany(userId, dto.companyId);
    if (existing) {
      throw new ConflictError('Company access already exists for this user');
    }

    return userRepository.createCompanyAccess({
      userId,
      companyId: dto.companyId,
      groupId: dto.groupId || null,
      accessScope: dto.accessScope,
      roleOverride: dto.roleOverride || null,
    });
  }

  async updateCompanyAccess(userId: string, accessId: string, dto: UpdateUserCompanyAccessDTO) {
    await this.findById(userId);

    const current = await userRepository.findCompanyAccessById(accessId);
    if (!current || current.userId !== userId) {
      throw new NotFoundError('User company access not found');
    }

    // Requester must control both the grant as it exists and as it will be.
    assertCompanyAccessAuthority(current.companyId, { groupId: current.groupId, accessScope: current.accessScope });
    const nextCompanyId = dto.companyId || current.companyId;
    assertCompanyAccessAuthority(nextCompanyId, {
      groupId: dto.groupId !== undefined ? dto.groupId : current.groupId,
      accessScope: dto.accessScope ?? current.accessScope,
    });
    if (nextCompanyId !== current.companyId) {
      const existing = await userRepository.findCompanyAccessByUserAndCompany(userId, nextCompanyId);
      if (existing && existing.id !== accessId) {
        throw new ConflictError('Company access already exists for this user');
      }
    }

    return userRepository.updateCompanyAccess(accessId, {
      ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
      ...(dto.groupId !== undefined ? { groupId: dto.groupId || null } : {}),
      ...(dto.accessScope !== undefined ? { accessScope: dto.accessScope } : {}),
      ...(dto.roleOverride !== undefined ? { roleOverride: dto.roleOverride || null } : {}),
    });
  }

  async deleteCompanyAccess(userId: string, accessId: string) {
    await this.findById(userId);

    const current = await userRepository.findCompanyAccessById(accessId);
    if (!current || current.userId !== userId) {
      throw new NotFoundError('User company access not found');
    }
    assertCompanyAccessAuthority(current.companyId, { groupId: current.groupId, accessScope: current.accessScope });

    await userRepository.deleteCompanyAccess(accessId);
  }
}

export const userService = new UserService();
