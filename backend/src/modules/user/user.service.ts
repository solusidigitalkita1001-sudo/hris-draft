import { userRepository } from './user.repository';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError } from '@/shared/exceptions/AppError';
import { CreateUserDTO, UpdateUserDTO } from './user.dto';
import { authRepository } from '../auth/auth.repository';

const logger = new WinstonLogger('UserService');

export class UserService {
  async findAll(page: number, limit: number) {
    return userRepository.findAll(page, limit);
  }

  async findById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
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

    return userRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await userRepository.softDelete(id);
    logger.info(`User soft deleted: ${id}`);
  }
}

export const userService = new UserService();
