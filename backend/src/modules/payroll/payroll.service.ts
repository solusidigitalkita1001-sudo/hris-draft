import { payrollRepository } from './payroll.repository';
import {
  CreateSalaryComponentDTO,
  UpdateSalaryComponentDTO,
  CreateEmployeeSalaryDTO,
  UpdateEmployeeSalaryDTO,
  CreatePayrollPeriodDTO,
  UpdatePayrollPeriodDTO,
  CreatePayrollRunDTO,
} from './payroll.dto';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { logger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError, BadRequestError } from '@/shared/exceptions/AppError';
import { v4 as uuidv4 } from 'uuid';

export class PayrollService {
  // ==================== Salary Components ====================

  async findAllSalaryComponents(companyId: string) {
    return payrollRepository.findAllSalaryComponents(companyId);
  }

  async findSalaryComponentById(id: string) {
    const component = await payrollRepository.findSalaryComponentById(id);
    if (!component) throw new NotFoundError('Salary component not found');
    return component;
  }

  async createSalaryComponent(data: CreateSalaryComponentDTO) {
    // Check for duplicate code
    const existing = await payrollRepository.findSalaryComponentByCode(data.companyId, data.code);
    if (existing) throw new ConflictError('Salary component code already exists');

    const component = await payrollRepository.createSalaryComponent(data);

    logger.info('Salary component created', { componentId: component.id, code: component.code });
    return component;
  }

  async updateSalaryComponent(id: string, data: UpdateSalaryComponentDTO) {
    await this.findSalaryComponentById(id);
    const component = await payrollRepository.updateSalaryComponent(id, data);

    logger.info('Salary component updated', { componentId: id });
    return component;
  }

  async deleteSalaryComponent(id: string) {
    await this.findSalaryComponentById(id);
    await payrollRepository.softDeleteSalaryComponent(id);

    logger.info('Salary component deleted', { componentId: id });
  }

  // ==================== Employee Salaries ====================

  async findAllEmployeeSalaries(companyId: string, employeeId?: string) {
    return payrollRepository.findAllEmployeeSalaries(companyId, employeeId);
  }

  async findEmployeeSalaryById(id: string) {
    const salary = await payrollRepository.findEmployeeSalaryById(id);
    if (!salary) throw new NotFoundError('Employee salary not found');
    return salary;
  }

  async createEmployeeSalary(data: CreateEmployeeSalaryDTO) {
    // Deactivate existing active salary if any
    const existing = await payrollRepository.findActiveEmployeeSalary(data.employeeId);
    if (existing) {
      await payrollRepository.updateEmployeeSalary(existing.id, { isActive: false });
    }

    const salary = await payrollRepository.createEmployeeSalary(data);

    logger.info('Employee salary created', {
      employeeId: data.employeeId,
      salaryId: salary.id,
    });

    return salary;
  }

  async updateEmployeeSalary(id: string, data: UpdateEmployeeSalaryDTO) {
    await this.findEmployeeSalaryById(id);
    return payrollRepository.updateEmployeeSalary(id, data);
  }

  // ==================== Payroll Periods ====================

  async findAllPayrollPeriods(companyId: string) {
    return payrollRepository.findAllPayrollPeriods(companyId);
  }

  async findPayrollPeriodById(id: string) {
    const period = await payrollRepository.findPayrollPeriodById(id);
    if (!period) throw new NotFoundError('Payroll period not found');
    return period;
  }

  async createPayrollPeriod(data: CreatePayrollPeriodDTO) {
    const period = await payrollRepository.createPayrollPeriod(data);

    logger.info('Payroll period created', { periodId: period.id, code: period.code });
    return period;
  }

  async closePayrollPeriod(id: string) {
    await this.findPayrollPeriodById(id);
    const period = await payrollRepository.closePayrollPeriod(id);

    logger.info('Payroll period closed', { periodId: id });
    return period;
  }

  async updatePayrollPeriod(id: string, data: UpdatePayrollPeriodDTO) {
    const period = await this.findPayrollPeriodById(id);
    if (period.status === 'CLOSED') {
      throw new BadRequestError('Cannot update a closed payroll period');
    }
    return payrollRepository.updatePayrollPeriod(id, data);
  }

  // ==================== Payroll Runs ====================

  async findAllPayrollRuns(companyId: string) {
    return payrollRepository.findAllPayrollRuns(companyId);
  }

  async findPayrollRunById(id: string) {
    const run = await payrollRepository.findPayrollRunById(id);
    if (!run) throw new NotFoundError('Payroll run not found');
    return run;
  }

  async createPayrollRun(data: CreatePayrollRunDTO, userId?: string) {
    // Validate period exists and is not closed
    const period = await this.findPayrollPeriodById(data.periodId);
    if (period.status === 'CLOSED') {
      throw new BadRequestError('Cannot create payroll run for a closed period');
    }

    // Get run number
    const lastRunNumber = await payrollRepository.findLatestRunNumber(data.companyId);
    const runNumber = lastRunNumber + 1;

    // Create run
    const run = await payrollRepository.createPayrollRun(data, runNumber);

    // Run payroll calculation
    await this.calculatePayroll(run.id);

    // Publish event
    await eventBus.publish({
      name: DomainEvents.PAYROLL_RUN_CREATED,
      aggregateId: run.id,
      aggregateType: 'PayrollRun',
      data: { runNumber, companyId: data.companyId, periodId: data.periodId },
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
      },
    });

    logger.info('Payroll run created', { runId: run.id, runNumber });
    return this.findPayrollRunById(run.id);
  }

  async approvePayrollRun(id: string, userId: string) {
    const run = await this.findPayrollRunById(id);
    if (run.status !== 'COMPLETED') {
      throw new BadRequestError('Only completed payroll runs can be approved');
    }

    const approved = await payrollRepository.updatePayrollRunStatus(id, 'APPROVED', userId);

    await eventBus.publish({
      name: DomainEvents.PAYROLL_RUN_APPROVED,
      aggregateId: id,
      aggregateType: 'PayrollRun',
      data: { approvedBy: userId },
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
      },
    });

    return approved;
  }

  async disbursePayrollRun(id: string, userId: string) {
    const run = await this.findPayrollRunById(id);
    if (run.status !== 'APPROVED') {
      throw new BadRequestError('Only approved payroll runs can be disbursed');
    }

    const disbursed = await payrollRepository.updatePayrollRunStatus(id, 'DISBURSED', userId);

    await eventBus.publish({
      name: DomainEvents.PAYROLL_RUN_DISBURSED,
      aggregateId: id,
      aggregateType: 'PayrollRun',
      data: { disbursedBy: userId },
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
      },
    });

    return disbursed;
  }

  // ==================== Payslips ====================

  async findPayslipById(id: string) {
    const payslip = await payrollRepository.findPayslipById(id);
    if (!payslip) throw new NotFoundError('Payslip not found');
    return payslip;
  }

  async findPayslipsByEmployee(employeeId: string) {
    return payrollRepository.findPayslipsByEmployee(employeeId);
  }

  // ==================== Payroll Calculation ====================

  private async calculatePayroll(runId: string) {
    const run = await payrollRepository.findPayrollRunById(runId);
    if (!run) throw new NotFoundError('Payroll run not found');

    // Get all employees with active salary in this company
    const employeeSalaries = await payrollRepository.findAllEmployeeSalaries(run.companyId);

    // Delete existing payslips for this run (recalculation)
    await payrollRepository.deletePayslipsByRunId(runId);

    let totalEarnings = 0;
    let totalDeductions = 0;
    let employeeCount = 0;

    for (const salary of employeeSalaries) {
      if (!salary.isActive) continue;

      const { earningsTotal, deductionsTotal, components } = this.calculateEmployeePay(salary);
      const netPay = earningsTotal - deductionsTotal;

      // Create payslip
      const payslip = await payrollRepository.createPayslip({
        payrollRun: { connect: { id: runId } },
        employee: { connect: { id: salary.employeeId } },
        company: { connect: { id: run.companyId } },
        employeeSalary: { connect: { id: salary.id } },
        baseSalary: salary.baseSalary,
        totalEarnings: earningsTotal,
        totalDeductions: deductionsTotal,
        netPay,
        workDays: 0,
        presentDays: 0,
        leaveDays: 0,
        absentDays: 0,
        overtimeHours: 0,
        status: 'DRAFT',
      });

      // Create payslip components
      if (components.length > 0) {
        await payrollRepository.createPayslipComponents(
          components.map((c) => ({
            payslipId: payslip.id,
            salaryComponentId: c.salaryComponentId,
            name: c.name,
            type: c.type as any,
            amount: c.amount,
            isTaxable: c.isTaxable,
          }))
        );
      }

      totalEarnings += earningsTotal;
      totalDeductions += deductionsTotal;
      employeeCount++;
    }

    // Update run totals
    await payrollRepository.updatePayrollRunTotals(runId, {
      totalEmployees: employeeCount,
      totalEarnings,
      totalDeductions,
      totalNetPay: totalEarnings - totalDeductions,
    });

    // Mark run as completed
    await payrollRepository.updatePayrollRunStatus(runId, 'COMPLETED');

    logger.info('Payroll calculation completed', {
      runId,
      employeeCount,
      totalEarnings,
      totalDeductions,
    });
  }

  private calculateEmployeePay(salary: any) {
    let earningsTotal = 0;
    let deductionsTotal = 0;
    const components: Array<{
      salaryComponentId: string;
      name: string;
      type: string;
      amount: number;
      isTaxable: boolean;
    }> = [];

    for (const comp of salary.components) {
      if (!comp.isActive) continue;

      const { salaryComponent } = comp;
      let amount = Number(comp.amount);

      // Apply calculation method
      if (salaryComponent.calculationMethod === 'PERCENTAGE' && salaryComponent.ratePercent) {
        amount = Number(salary.baseSalary) * (Number(salaryComponent.ratePercent) / 100);
      }

      const componentEntry = {
        salaryComponentId: salaryComponent.id,
        name: salaryComponent.name,
        type: salaryComponent.type as any,
        amount,
        isTaxable: salaryComponent.isTaxable,
      };

      components.push(componentEntry);

      if (salaryComponent.type === 'ALLOWANCE') {
        earningsTotal += amount;
      } else {
        deductionsTotal += amount;
      }
    }

    return { earningsTotal, deductionsTotal, components };
  }
}

export const payrollService = new PayrollService();
