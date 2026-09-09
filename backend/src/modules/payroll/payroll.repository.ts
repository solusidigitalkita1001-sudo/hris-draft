import { ConflictError } from '@/shared/exceptions/AppError';
import { prisma } from '@/shared/database/prisma';
import { Prisma, PayrollRunStatus } from '@prisma/client';
import { compileFormula } from '@/shared/payroll/formula';
import {
  CreateSalaryComponentDTO,
  UpdateSalaryComponentDTO,
  CreateEmployeeSalaryDTO,
  UpdateEmployeeSalaryDTO,
  CreatePayrollPeriodDTO,
  UpdatePayrollPeriodDTO,
  CreatePayrollRunDTO,
} from './payroll.dto';

const payslipRunSelect = {
  id: true, name: true, runNumber: true, status: true,
  period: { select: { id: true, name: true, code: true, frequency: true, startDate: true, endDate: true, payDate: true } },
} satisfies Prisma.PayrollRunSelect;

function runAccessWhere(companyId: string): Prisma.PayrollRunWhereInput {
  return { companyId, deletedAt: null, period: { companyId, deletedAt: null } };
}

function payslipAccessWhere(companyId: string, employeeWhere: Prisma.EmployeeWhereInput): Prisma.PayslipWhereInput {
  return { companyId, employee: { companyId, deletedAt: null, AND: [employeeWhere] }, payrollRun: runAccessWhere(companyId) };
}

export class PayrollRepository {
  // ==================== Salary Components ====================

  async findAllSalaryComponents(companyId: string) {
    return prisma.salaryComponent.findMany({
      where: { companyId, deletedAt: null },
      include: { formulaVersions: { select: { id: true, version: true, effectiveFrom: true, status: true }, orderBy: { version: 'desc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findSalaryComponentById(id: string) {
    return prisma.salaryComponent.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findSalaryComponentByCode(companyId: string, code: string, database: Prisma.TransactionClient = prisma) {
    return database.salaryComponent.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  async createSalaryComponent(data: CreateSalaryComponentDTO & { code: string }, database: Prisma.TransactionClient = prisma) {
    return database.salaryComponent.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        type: data.type,
        calculationMethod: data.calculationMethod,
        amount: data.amount,
        ratePercent: data.ratePercent,
        isTaxable: data.isTaxable,
        isProrated: data.isProrated,
        description: data.description,
        sortOrder: data.sortOrder,
      },
    });
  }

  async updateSalaryComponent(id: string, data: UpdateSalaryComponentDTO) {
    return prisma.salaryComponent.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        calculationMethod: data.calculationMethod,
        amount: data.amount,
        ratePercent: data.ratePercent,
        isTaxable: data.isTaxable,
        isProrated: data.isProrated,
        description: data.description,
        sortOrder: data.sortOrder,
      },
    });
  }

  async softDeleteSalaryComponent(id: string) {
    return prisma.$transaction(async tx => {
      const component = await tx.salaryComponent.findFirstOrThrow({ where: { id, deletedAt: null } });
      // Shares the publication lock so a reference cannot be published while
      // its component is being removed.
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${component.companyId} FOR UPDATE`;
      const versions = await tx.payrollFormulaVersion.findMany({ where: { companyId: component.companyId, status: 'PUBLISHED' } });
      if (versions.some(version => version.componentId === id || compileFormula(version.expression).references.includes(component.code))) {
        throw new ConflictError('A component used by a published payroll formula cannot be deleted');
      }
      return tx.salaryComponent.update({ where: { id, companyId: component.companyId }, data: { deletedAt: new Date() } });
    });
  }

  // ==================== Employee Salaries ====================

  async findAllEmployeeSalaries(companyId: string, employeeId?: string, database: Prisma.TransactionClient = prisma) {
    const where: Prisma.EmployeeSalaryWhereInput = { companyId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;

    return database.employeeSalary.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            fullName: true,
            employeeNumber: true,
            maritalStatus: true,
            taxId: true,
            // dependents for PTKP (Task 2.6)
            _count: { select: { families: { where: { isDependent: true } } } },
          },
        },
        components: {
          include: {
            salaryComponent: true,
          },
        },
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async findEmployeeSalariesForAccess(companyId: string, employeeWhere: Prisma.EmployeeWhereInput, employeeId?: string) {
    return prisma.employeeSalary.findMany({
      where: { companyId, employeeId, deletedAt: null, employee: { companyId, deletedAt: null, AND: [employeeWhere] } },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        components: { where: { salaryComponent: { companyId } }, include: { salaryComponent: true } },
      },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'asc' }],
    });
  }

  async findEmployeeSalaryById(id: string, companyId: string, employeeWhere: Prisma.EmployeeWhereInput) {
    return prisma.employeeSalary.findFirst({
      where: { id, companyId, deletedAt: null, employee: { companyId, deletedAt: null, AND: [employeeWhere] } },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        components: {
          where: { salaryComponent: { companyId } },
          include: {
            salaryComponent: true,
          },
        },
      },
    });
  }

  async findActiveEmployeeSalary(employeeId: string) {
    return prisma.employeeSalary.findFirst({
      where: { employeeId, isActive: true, deletedAt: null },
      include: {
        components: {
          where: { isActive: true },
          include: { salaryComponent: true },
        },
      },
    });
  }

  async createEmployeeSalary(data: CreateEmployeeSalaryDTO & { companyId: string }, database: Prisma.TransactionClient) {
    const { components, ...salaryData } = data;
    return database.employeeSalary.create({
      data: {
        employeeId: salaryData.employeeId,
        companyId: salaryData.companyId,
        effectiveDate: new Date(salaryData.effectiveDate),
        baseSalary: salaryData.baseSalary,
        currency: salaryData.currency,
        notes: salaryData.notes,
        components: components?.length
          ? {
              create: components.map((c) => ({
                salaryComponentId: c.salaryComponentId,
                amount: c.amount,
              })),
            }
          : undefined,
      },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        components: {
          include: { salaryComponent: true },
        },
      },
    });
  }

  async updateEmployeeSalary(id: string, companyId: string, data: UpdateEmployeeSalaryDTO, database: Prisma.TransactionClient) {
    const { components, ...salaryData } = data;
    const updateData: Prisma.EmployeeSalaryUpdateInput = {};

    if (salaryData.baseSalary !== undefined) updateData.baseSalary = salaryData.baseSalary;
    if (salaryData.currency !== undefined) updateData.currency = salaryData.currency;
    if (salaryData.isActive !== undefined) updateData.isActive = salaryData.isActive;
    if (salaryData.notes !== undefined) updateData.notes = salaryData.notes;
    if (salaryData.effectiveDate !== undefined) updateData.effectiveDate = new Date(salaryData.effectiveDate);

    if (components) {
      // Delete existing components and recreate
      await database.employeeSalaryComponent.deleteMany({ where: { employeeSalaryId: id, employeeSalary: { companyId } } });
      await database.employeeSalaryComponent.createMany({
        data: components.map((c) => ({
          employeeSalaryId: id,
          salaryComponentId: c.salaryComponentId,
          amount: c.amount,
        })),
      });
    }

    return database.employeeSalary.update({
      where: { id, companyId, deletedAt: null },
      data: updateData,
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        components: {
          include: { salaryComponent: true },
        },
      },
    });
  }

  // ==================== Payroll Periods ====================

  async findAllPayrollPeriods(companyId: string) {
    return prisma.payrollPeriod.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }

  async findPayrollPeriodById(id: string, database: Prisma.TransactionClient = prisma, companyId?: string) {
    return database.payrollPeriod.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async createPayrollPeriod(data: CreatePayrollPeriodDTO & { code: string }) {
    return prisma.payrollPeriod.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        frequency: data.frequency as any,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        payDate: new Date(data.payDate),
        notes: data.notes,
      },
    });
  }

  async closePayrollPeriod(id: string, companyId: string) {
    return prisma.payrollPeriod.update({
      where: { id, companyId, deletedAt: null },
      data: { status: 'CLOSED' as any },
    });
  }

  async updatePayrollPeriod(id: string, data: UpdatePayrollPeriodDTO, companyId: string) {
    return prisma.payrollPeriod.update({
      where: { id, companyId, deletedAt: null },
      data: {
        name: data.name,
        notes: data.notes,
      },
    });
  }

  async confirmAttendanceReview(id: string, userId: string, companyId: string) {
    return prisma.payrollPeriod.update({
      where: { id, companyId, deletedAt: null, status: { not: 'CLOSED' } },
      data: { attendanceReviewedAt: new Date(), attendanceReviewedBy: userId },
    });
  }

  // ==================== Payroll Runs ====================

  async findAllPayrollRuns(companyId: string) {
    return prisma.payrollRun.findMany({
      where: runAccessWhere(companyId),
      include: {
        period: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
        _count: { select: { payslips: { where: payslipAccessWhere(companyId, {}) } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPayrollRunForAccess(id: string, companyId: string) {
    return prisma.payrollRun.findFirst({
      where: { id, ...runAccessWhere(companyId) },
      include: {
        period: true,
        company: { select: { id: true, name: true } },
        payslips: {
          where: payslipAccessWhere(companyId, {}),
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
            components: { where: { salaryComponent: { companyId } }, include: { salaryComponent: true } },
          },
        },
      },
    });
  }

  async findPayrollRunById(id: string, database: Prisma.TransactionClient = prisma) {
    return database.payrollRun.findFirst({
      where: { id, deletedAt: null },
      include: {
        period: true,
        company: { select: { id: true, name: true } },
        payslips: {
          include: {
            employee: {
              select: {
                id: true, fullName: true, employeeNumber: true,
                bankName: true, bankCode: true, bankAccount: true, bankAccountHolder: true,
                bankAccounts: true, // B.6 MULTIBANK: include multiple bank accounts array untuk pilih primary
              },
            },
            components: {
              include: { salaryComponent: true },
            },
          },
        },
      },
    });
  }

  async findLatestRunNumber(companyId: string, database: Prisma.TransactionClient = prisma): Promise<number> {
    const lastRun = await database.payrollRun.findFirst({
      where: { companyId },
      orderBy: { runNumber: 'desc' },
      select: { runNumber: true },
    });
    return lastRun?.runNumber ?? 0;
  }

  async createPayrollRun(data: CreatePayrollRunDTO, runNumber: number, createdBy: string, database: Prisma.TransactionClient = prisma) {
    return database.payrollRun.create({
      data: {
        periodId: data.periodId,
        companyId: data.companyId,
        name: data.name,
        runNumber,
        createdBy,
      },
    });
  }

  async approvePayrollRun(id: string, userId: string, companyId: string) {
    return prisma.$transaction(async tx => {
      const result = await tx.payrollRun.updateMany({
        where: { id, ...runAccessWhere(companyId), status: 'COMPLETED', createdBy: { not: null }, AND: [{ createdBy: { not: userId } }] },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      });
      if (result.count !== 1) throw new ConflictError('Payroll changed or maker-checker validation failed');
      return tx.payrollRun.findUniqueOrThrow({ where: { id, companyId } });
    });
  }

  async updatePayrollRunStatus(id: string, status: PayrollRunStatus, userId?: string, database: Prisma.TransactionClient = prisma) {
    const updateData: Prisma.PayrollRunUpdateInput = {
      status,
    };

    if (status === 'APPROVED') {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }
    if (status === 'DISBURSED') {
      updateData.disbursedBy = userId;
      updateData.disbursedAt = new Date();
    }

    return database.payrollRun.update({
      where: { id },
      data: updateData,
    });
  }

  async updatePayrollRunTotals(id: string, data: { totalEmployees: number; totalEarnings: Prisma.Decimal; totalDeductions: Prisma.Decimal; totalNetPay: Prisma.Decimal }, database: Prisma.TransactionClient = prisma) {
    return database.payrollRun.update({
      where: { id },
      data,
    });
  }

  // ==================== Payslips ====================

  async findPayslipsByRunId(payrollRunId: string) {
    return prisma.payslip.findMany({
      where: { payrollRunId },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        components: {
          include: { salaryComponent: true },
        },
      },
    });
  }

  async findPayslipById(id: string, companyId: string, employeeWhere: Prisma.EmployeeWhereInput) {
    return prisma.$transaction(async database => {
      const payslip = await database.payslip.findFirst({
        where: { id, ...payslipAccessWhere(companyId, employeeWhere) },
        include: {
          employee: { select: { id: true, fullName: true, employeeNumber: true, departmentId: true, positionId: true } },
          payrollRun: { select: payslipRunSelect },
          components: { where: { salaryComponent: { companyId } }, include: { salaryComponent: true } },
        },
      });
      if (!payslip) return null;
      // Read dependent evidence only after the parent employee has passed scope.
      const formulaCalculations = await database.payrollFormulaCalculation.findMany({
        where: { companyId, payslipId: id, runId: payslip.payrollRunId,
          component: { companyId }, version: { companyId } },
      });
      const benefitDeductions = await database.benefitDeduction.findMany({
        where: { payslipId: id, benefitEnrollment: { companyId, employeeId: payslip.employeeId, benefitPlan: { companyId } } },
        include: { benefitEnrollment: { include: { benefitPlan: true } } },
      });
      return { ...payslip, formulaCalculations, benefitDeductions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10000, timeout: 60000 });
  }

  async findPayslipsByEmployee(employeeId: string, companyId: string, employeeWhere: Prisma.EmployeeWhereInput, limit = 20) {
    return prisma.payslip.findMany({
      where: { employeeId, ...payslipAccessWhere(companyId, employeeWhere) },
      include: {
        payrollRun: { select: payslipRunSelect },
        components: { where: { salaryComponent: { companyId } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async createPayslip(data: Prisma.PayslipCreateInput, database: Prisma.TransactionClient = prisma) {
    return database.payslip.create({ data });
  }

  async createPayslipComponents(data: Prisma.PayslipComponentCreateManyInput[], database: Prisma.TransactionClient = prisma) {
    if (data.length === 0) return;
    await database.payslipComponent.createMany({ data });
  }

  async deletePayslipsByRunId(payrollRunId: string) {
    // Delete components first due to FK constraints
    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId },
      select: { id: true },
    });
    const payslipIds = payslips.map((p) => p.id);

    if (payslipIds.length > 0) {
      await prisma.benefitDeduction.deleteMany({ where: { payslipId: { in: payslipIds } } });
      await prisma.payslipComponent.deleteMany({ where: { payslipId: { in: payslipIds } } });
    }
    await prisma.payslip.deleteMany({ where: { payrollRunId } });
  }
}

export const payrollRepository = new PayrollRepository();
