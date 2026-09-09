import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/shared/database/prisma';
import { getCurrentCompanyId, getCurrentUser } from '@/shared/context/RequestContext';
import { employeeAccessWhere } from '@/shared/security/employee-data-scope';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/shared/exceptions/AppError';
import { payrollDate } from '@/shared/payroll/attendance-calendar';
import { createEmployeeSalarySchema, updateEmployeeSalarySchema, CreateEmployeeSalaryDTO, UpdateEmployeeSalaryDTO, SalaryComponentAllocationDTO } from './payroll.dto';
import { payrollRepository } from './payroll.repository';

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError('Invalid salary allocation', result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
  return result.data;
}

async function access() {
  const companyId = getCurrentCompanyId();
  if (!getCurrentUser()?.id || !companyId) throw new ForbiddenError('Salary access requires an authenticated company context');
  return { companyId, employeeWhere: await employeeAccessWhere('payroll') };
}

// Same company lock as payroll calculation and formula publication. Financial
// edits and a payroll that consumes them cannot commit in the opposite order.
async function transaction<T>(companyId: string, work: (database: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async database => {
        const company = await database.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { id: true } });
        if (!company) throw new NotFoundError('Company not found');
        await database.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
        return work(database);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
}

async function validateComponents(database: Prisma.TransactionClient, companyId: string, allocations: SalaryComponentAllocationDTO[] | undefined) {
  if (!allocations?.length) return;
  const rows = await database.salaryComponent.findMany({
    where: { id: { in: allocations.map(row => row.salaryComponentId) }, companyId, isActive: true, deletedAt: null }, select: { id: true },
  });
  if (rows.length !== allocations.length) throw new ValidationError('Salary components must be active and belong to this company');
}

async function validateEffectiveDate(database: Prisma.TransactionClient, companyId: string, employeeId: string, effectiveDate: string, exceptId?: string) {
  const start = payrollDate(new Date(effectiveDate)), end = new Date(start.getTime() + 86400000);
  const duplicate = await database.employeeSalary.findFirst({ where: {
    companyId, employeeId, deletedAt: null, id: exceptId ? { not: exceptId } : undefined, effectiveDate: { gte: start, lt: end },
  }, select: { id: true } });
  if (duplicate) throw new ConflictError('A salary allocation already exists for this effective date; review the existing allocation');
}

export const employeeSalaryService = {
  async list(requestedCompanyId?: string, employeeId?: string) {
    const { companyId, employeeWhere } = await access();
    if (requestedCompanyId && requestedCompanyId !== companyId) throw new ForbiddenError('Salary company must match the active company');
    return payrollRepository.findEmployeeSalariesForAccess(companyId, employeeWhere, employeeId);
  },

  async findById(id: string) {
    const { companyId, employeeWhere } = await access();
    const salary = await payrollRepository.findEmployeeSalaryById(id, companyId, employeeWhere);
    if (!salary) throw new NotFoundError('Employee salary not found in the permitted payroll scope');
    return salary;
  },

  async thrInputs(employeeId: string) {
    const { companyId, employeeWhere } = await access();
    return prisma.$transaction(async database => {
      const employee = await database.employee.findFirst({
        where: { id: employeeId, companyId, deletedAt: null, AND: [employeeWhere] },
        select: { id: true, fullName: true, employeeNumber: true, joinDate: true },
      });
      if (!employee) throw new NotFoundError('Employee not found in the permitted payroll scope');
      const salaries = await database.employeeSalary.findMany({
        where: { companyId, employeeId: employee.id, isActive: true, deletedAt: null },
        select: { baseSalary: true, currency: true }, take: 2,
      });
      if (salaries.length > 1) throw new ConflictError('Multiple active salaries found; review the existing allocations');
      const salary = salaries[0] ?? null;
      if (salary && (salary.currency !== 'IDR' || !salary.baseSalary.isFinite() || salary.baseSalary.lessThanOrEqualTo(0))) {
        throw new ValidationError('THR requires a valid IDR salary allocation');
      }
      return { employee, salary };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10000, timeout: 60000 });
  },

  async create(input: CreateEmployeeSalaryDTO) {
    const { companyId, employeeWhere } = await access();
    const data = parse(createEmployeeSalarySchema, input);
    if (data.companyId && data.companyId !== companyId) throw new ForbiddenError('Salary company must match the active company');
    return transaction(companyId, async database => {
      const employee = await database.employee.findFirst({ where: { id: data.employeeId, companyId, deletedAt: null, AND: [employeeWhere] }, select: { id: true } });
      if (!employee) throw new NotFoundError('Employee not found in the permitted payroll scope');
      await validateComponents(database, companyId, data.components);
      await validateEffectiveDate(database, companyId, employee.id, data.effectiveDate);
      const active = await database.employeeSalary.findMany({ where: { companyId, employeeId: employee.id, isActive: true, deletedAt: null }, select: { id: true } });
      if (active.length > 1) throw new ConflictError('Multiple active salaries found; review the existing allocations');
      await database.employeeSalary.updateMany({ where: { companyId, employeeId: employee.id, isActive: true, deletedAt: null }, data: { isActive: false } });
      return payrollRepository.createEmployeeSalary({ ...data, companyId }, database);
    });
  },

  async update(id: string, input: UpdateEmployeeSalaryDTO) {
    const { companyId, employeeWhere } = await access();
    const data = parse(updateEmployeeSalarySchema, input);
    return transaction(companyId, async database => {
      const salary = await database.employeeSalary.findFirst({ where: {
        id, companyId, deletedAt: null, employee: { companyId, deletedAt: null, AND: [employeeWhere] },
      }, include: { components: true } });
      if (!salary) throw new NotFoundError('Employee salary not found in the permitted payroll scope');
      const financialChange = data.baseSalary !== undefined || data.currency !== undefined || data.effectiveDate !== undefined || data.components !== undefined;
      if (financialChange && await database.payslip.findFirst({ where: { employeeSalaryId: id }, select: { id: true } })) {
        throw new ConflictError('This salary allocation has been used by payroll; create a new allocation for financial changes');
      }
      await validateComponents(database, companyId, data.components);
      if (data.effectiveDate !== undefined) await validateEffectiveDate(database, companyId, salary.employeeId, data.effectiveDate, id);
      if (data.isActive === true) {
        const otherActive = await database.employeeSalary.findFirst({ where: {
          companyId, employeeId: salary.employeeId, id: { not: id }, isActive: true, deletedAt: null,
        }, select: { id: true } });
        if (otherActive) throw new ConflictError('Another salary allocation is active for this employee');
        // Re-activation also validates the stored legacy allocation when the
        // caller does not replace its financial fields/components.
        parse(createEmployeeSalarySchema, {
          employeeId: salary.employeeId, baseSalary: data.baseSalary ?? salary.baseSalary.toNumber(),
          currency: data.currency ?? salary.currency, effectiveDate: data.effectiveDate ?? salary.effectiveDate.toISOString(),
          components: data.components ?? salary.components.filter(row => row.isActive).map(row => ({ salaryComponentId: row.salaryComponentId, amount: row.amount.toNumber() })),
        });
        await validateComponents(database, companyId, data.components ?? salary.components.filter(row => row.isActive)
          .map(row => ({ salaryComponentId: row.salaryComponentId, amount: row.amount.toNumber() })));
      }
      return payrollRepository.updateEmployeeSalary(id, companyId, data, database);
    });
  },
};
