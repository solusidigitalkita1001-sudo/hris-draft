import { parse } from 'csv-parse/sync';
import { employeeRepository } from './employee.repository';
import { CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeQueryDTO, CreateCareerTransactionDTO, createEmployeeSchema } from './employee.dto';
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

  async importCsv(companyId: string, file: Express.Multer.File) {
    const records = parse(file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const errors: { row: number; employeeNumber?: string; message: string }[] = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i++) {
      const rowIndex = i + 2; // +2 because row 1 is header, so data starts at row 2
      const row = records[i] as Record<string, string>;

      try {
        const payload: CreateEmployeeDTO = {
          companyId,
          employeeNumber: row.employeeNumber || row.nik || '',
          firstName: row.firstName || row.first_name || '',
          lastName: row.lastName || row.last_name || '',
          email: row.email || undefined,
          phone: row.phone || undefined,
          idNumber: row.idNumber || row.id_number || row.ktp || undefined,
          placeOfBirth: row.placeOfBirth || row.place_of_birth || undefined,
          dateOfBirth: row.dateOfBirth || row.date_of_birth || undefined,
          gender: row.gender || undefined,
          religion: row.religion || undefined,
          maritalStatus: row.maritalStatus || row.marital_status || undefined,
          bloodType: row.bloodType || row.blood_type || undefined,
          nationality: row.nationality || 'Indonesia',
          address: row.address || undefined,
          joinDate: row.joinDate || row.join_date || undefined,
          employmentType: (row.employmentType || row.employment_type || 'PERMANENT') as any,
          branchId: row.branchId || row.branch_id || undefined,
          departmentId: row.departmentId || row.department_id || undefined,
          subDepartmentId: row.subDepartmentId || row.sub_department_id || undefined,
          positionId: row.positionId || row.position_id || undefined,
          bankName: row.bankName || row.bank_name || undefined,
          bankAccount: row.bankAccount || row.bank_account || undefined,
          bankAccountHolder: row.bankAccountHolder || row.bank_account_holder || undefined,
          taxId: row.taxId || row.tax_id || row.npwp || undefined,
          bpjsKetenagakerjaan: row.bpjsKetenagakerjaan || row.bpjs_ketenagakerjaan || undefined,
          bpjsKesehatan: row.bpjsKesehatan || row.bpjs_kesehatan || undefined,
          avatar: row.avatar || undefined,
        };

        const parsed = createEmployeeSchema.parse(payload);
        await this.create(parsed);
        success++;
      } catch (err: any) {
        failed++;
        errors.push({
          row: rowIndex,
          employeeNumber: row.employeeNumber || row.nik || 'N/A',
          message: err?.message || err?.toString() || 'Unknown error',
        });
      }
    }

    logger.info('CSV import completed', { total: records.length, success, failed });

    return {
      total: records.length,
      success,
      failed,
      errors,
    };
  }

  async exportCsv(companyId: string) {
    const { data: employees } = await this.findAll({
      companyId,
      page: 1,
      limit: 99999,
    });

    const headers = [
      'employeeNumber',
      'firstName',
      'lastName',
      'fullName',
      'email',
      'phone',
      'gender',
      'religion',
      'maritalStatus',
      'bloodType',
      'nationality',
      'idNumber',
      'placeOfBirth',
      'dateOfBirth',
      'address',
      'employmentType',
      'joinDate',
      'department',
      'position',
      'branch',
      'bankName',
      'bankAccount',
      'bankAccountHolder',
      'taxId',
      'bpjsKetenagakerjaan',
      'bpjsKesehatan',
      'employmentStatus',
    ];

    const csvEscape = (val: any): string => {
      const str = val == null ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = employees.map((emp: any) =>
      [
        emp.employeeNumber,
        emp.firstName,
        emp.lastName,
        emp.fullName,
        emp.email,
        emp.phone,
        emp.gender,
        emp.religion,
        emp.maritalStatus,
        emp.bloodType,
        emp.nationality,
        emp.idNumber,
        emp.placeOfBirth,
        emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : '',
        emp.address,
        emp.employmentType,
        emp.joinDate ? new Date(emp.joinDate).toISOString().split('T')[0] : '',
        emp.department?.name || '',
        emp.position?.name || '',
        emp.branch?.name || '',
        emp.bankName,
        emp.bankAccount,
        emp.bankAccountHolder,
        emp.taxId,
        emp.bpjsKetenagakerjaan,
        emp.bpjsKesehatan,
        emp.employmentStatus,
      ].map(csvEscape).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

export const employeeService = new EmployeeService();
