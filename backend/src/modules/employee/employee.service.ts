import { employeeRepository } from './employee.repository';
import { CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeQueryDTO, CreateCareerTransactionDTO } from './employee.dto';
import { NotFoundError, ConflictError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

export class EmployeeService {
  async findAll(query: EmployeeQueryDTO) {
    return employeeRepository.findAll(query);
  }

  async findById(id: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw new NotFoundError('Employee not found');
    return employee;
  }

  async create(data: CreateEmployeeDTO) {
    // Check unique employee number
    const existing = await employeeRepository.findByEmployeeNumber(data.companyId, data.employeeNumber);
    if (existing) throw new ConflictError('Employee number already exists');

    // Check unique email if provided
    if (data.email) {
      const emailExists = await employeeRepository.findByEmail(data.email);
      if (emailExists) throw new ConflictError('Email already in use');
    }

    const employee = await employeeRepository.create(data);
    logger.info('Employee created', { employeeId: employee.id, number: employee.employeeNumber });
    return employee;
  }

  async update(id: string, data: UpdateEmployeeDTO) {
    await this.findById(id);

    if (data.email) {
      const emailExists = await employeeRepository.findByEmail(data.email);
      if (emailExists && emailExists.id !== id) {
        throw new ConflictError('Email already in use');
      }
    }

    const employee = await employeeRepository.update(id, data);
    logger.info('Employee updated', { employeeId: id });
    return employee;
  }

  async delete(id: string) {
    await this.findById(id);
    await employeeRepository.softDelete(id);
    logger.info('Employee deleted', { employeeId: id });
  }

  async updateStatus(id: string, status: string) {
    await this.findById(id);
    const validStatuses = ['ACTIVE', 'RESIGNED', 'TERMINATED', 'PROBATION', 'CONTRACT_END'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestError(`Invalid status: ${status}`);
    }
    return employeeRepository.updateStatus(id, status);
  }

  async findCareerTransactions(employeeId: string) {
    await this.findById(employeeId);
    return employeeRepository.findCareerTransactions(employeeId);
  }

  async createCareerTransaction(employeeId: string, data: CreateCareerTransactionDTO, createdBy?: string) {
    const employee = await this.findById(employeeId);

    if (data.toDepartmentId === employee.departmentId &&
        data.toPositionId === employee.positionId &&
        data.toBranchId === employee.branchId &&
        (data.toEmploymentType === undefined || data.toEmploymentType === employee.employmentType)) {
      throw new BadRequestError('No actual career change detected');
    }

    const transaction = await employeeRepository.createCareerTransaction(employeeId, createdBy, data);

    if (!transaction) {
      throw new NotFoundError('Employee not found');
    }

    logger.info('Employee career transaction created', {
      employeeId,
      transactionType: data.transactionType,
      createdBy,
    });

    return transaction;
  }
}

export const employeeService = new EmployeeService();
