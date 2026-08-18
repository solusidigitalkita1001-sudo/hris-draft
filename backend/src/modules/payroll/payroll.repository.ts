import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateSalaryComponentDTO,
  UpdateSalaryComponentDTO,
  CreateEmployeeSalaryDTO,
  UpdateEmployeeSalaryDTO,
  CreatePayrollPeriodDTO,
  UpdatePayrollPeriodDTO,
  CreatePayrollRunDTO,
} from './payroll.dto';

export class PayrollRepository {
  // ==================== Salary Components ====================

  async findAllSalaryComponents(companyId: string) {
    return prisma.salaryComponent.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findSalaryComponentById(id: string) {
    return prisma.salaryComponent.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findSalaryComponentByCode(companyId: string, code: string) {
    return prisma.salaryComponent.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  async createSalaryComponent(data: CreateSalaryComponentDTO & { code: string }) {
    return prisma.salaryComponent.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        type: data.type as any,
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
        type: data.type as any,
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
    return prisma.salaryComponent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==================== Employee Salaries ====================

  async findAllEmployeeSalaries(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeSalaryWhereInput = { companyId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;

    return prisma.employeeSalary.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
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

  async findEmployeeSalaryById(id: string) {
    return prisma.employeeSalary.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        components: {
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

  /** Input untuk kalkulasi THR: upah aktif + tanggal masuk karyawan. */
  async findThrInputs(employeeId: string) {
    const [salary, employee] = await Promise.all([
      prisma.employeeSalary.findFirst({
        where: { employeeId, isActive: true, deletedAt: null },
        orderBy: { effectiveDate: 'desc' },
        select: { baseSalary: true },
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, fullName: true, employeeNumber: true, joinDate: true },
      }),
    ]);
    return { salary, employee };
  }

  async createEmployeeSalary(data: CreateEmployeeSalaryDTO) {
    const { components, ...salaryData } = data;
    return prisma.employeeSalary.create({
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

  async updateEmployeeSalary(id: string, data: UpdateEmployeeSalaryDTO) {
    const { components, ...salaryData } = data;
    const updateData: Prisma.EmployeeSalaryUpdateInput = {};

    if (salaryData.baseSalary !== undefined) updateData.baseSalary = salaryData.baseSalary;
    if (salaryData.currency !== undefined) updateData.currency = salaryData.currency;
    if (salaryData.isActive !== undefined) updateData.isActive = salaryData.isActive;
    if (salaryData.notes !== undefined) updateData.notes = salaryData.notes;
    if (salaryData.effectiveDate !== undefined) updateData.effectiveDate = new Date(salaryData.effectiveDate);

    if (components) {
      // Delete existing components and recreate
      await prisma.employeeSalaryComponent.deleteMany({ where: { employeeSalaryId: id } });
      await prisma.employeeSalaryComponent.createMany({
        data: components.map((c) => ({
          employeeSalaryId: id,
          salaryComponentId: c.salaryComponentId,
          amount: c.amount,
        })),
      });
    }

    return prisma.employeeSalary.update({
      where: { id },
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

  async findPayrollPeriodById(id: string) {
    return prisma.payrollPeriod.findFirst({
      where: { id, deletedAt: null },
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

  async closePayrollPeriod(id: string) {
    return prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'CLOSED' as any },
    });
  }

  async updatePayrollPeriod(id: string, data: UpdatePayrollPeriodDTO) {
    return prisma.payrollPeriod.update({
      where: { id },
      data: {
        name: data.name,
        notes: data.notes,
      },
    });
  }

  async confirmAttendanceReview(id: string, userId: string) {
    return prisma.payrollPeriod.update({
      where: { id },
      data: { attendanceReviewedAt: new Date(), attendanceReviewedBy: userId },
    });
  }

  // ==================== Payroll Runs ====================

  async findAllPayrollRuns(companyId: string) {
    return prisma.payrollRun.findMany({
      where: { companyId, deletedAt: null },
      include: {
        period: {
          select: { id: true, name: true, startDate: true, endDate: true },
        },
        _count: { select: { payslips: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPayrollRunById(id: string) {
    return prisma.payrollRun.findFirst({
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

  async findLatestRunNumber(companyId: string): Promise<number> {
    const lastRun = await prisma.payrollRun.findFirst({
      where: { companyId },
      orderBy: { runNumber: 'desc' },
      select: { runNumber: true },
    });
    return lastRun?.runNumber ?? 0;
  }

  async createPayrollRun(data: CreatePayrollRunDTO, runNumber: number) {
    return prisma.payrollRun.create({
      data: {
        periodId: data.periodId,
        companyId: data.companyId,
        name: data.name,
        runNumber,
      },
    });
  }

  async updatePayrollRunStatus(id: string, status: string, userId?: string) {
    const updateData: Prisma.PayrollRunUpdateInput = {
      status: status as any,
    };

    if (status === 'APPROVED') {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }
    if (status === 'DISBURSED') {
      updateData.disbursedBy = userId;
      updateData.disbursedAt = new Date();
    }

    return prisma.payrollRun.update({
      where: { id },
      data: updateData,
    });
  }

  async updatePayrollRunTotals(id: string, data: { totalEmployees: number; totalEarnings: number; totalDeductions: number; totalNetPay: number }) {
    return prisma.payrollRun.update({
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

  async findPayslipById(id: string) {
    return prisma.payslip.findFirst({
      where: { id },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeNumber: true, departmentId: true, positionId: true },
        },
        payrollRun: {
          include: { period: true },
        },
        components: {
          include: { salaryComponent: true },
        },
        benefitDeductions: {
          include: { benefitEnrollment: { include: { benefitPlan: true } } },
        },
      },
    });
  }

  async findPayslipsByEmployee(employeeId: string, limit = 20) {
    return prisma.payslip.findMany({
      where: { employeeId },
      include: {
        payrollRun: {
          include: { period: true },
        },
        components: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createPayslip(data: Prisma.PayslipCreateInput) {
    return prisma.payslip.create({ data });
  }

  async createPayslipComponents(data: Prisma.PayslipComponentCreateManyInput[]) {
    if (data.length === 0) return;
    await prisma.payslipComponent.createMany({ data });
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
