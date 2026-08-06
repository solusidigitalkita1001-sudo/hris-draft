import { leaveRepository } from './leave.repository';
import { CreateLeaveTypeDTO, CreateLeaveRequestDTO, CreateLeaveBalanceDTO } from './leave.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';

export class LeaveService {
  async findAllLeaveTypes(companyId: string) {
    return leaveRepository.findAllLeaveTypes(companyId);
  }

  async createLeaveType(data: CreateLeaveTypeDTO) {
    const type = await leaveRepository.createLeaveType(data);
    logger.info('Leave type created', { typeId: type.id, code: type.code });
    return type;
  }

  async findAllLeaveRequests(companyId: string, filters?: any) {
    return leaveRepository.findAllLeaveRequests(companyId, filters);
  }

  async findLeaveRequestById(id: string) {
    const request = await leaveRepository.findLeaveRequestById(id);
    if (!request) throw new NotFoundError('Leave request not found');
    return request;
  }

  async createLeaveRequest(data: CreateLeaveRequestDTO) {
    // Check balance
    const balances = await leaveRepository.findLeaveBalances(data.employeeId);
    const balance = balances.find((b) => b.leaveTypeId === data.leaveTypeId);
    if (balance && balance.remainingDays <= 0) {
      throw new BadRequestError('Insufficient leave balance');
    }

    const request = await leaveRepository.createLeaveRequest(data);
    logger.info('Leave request created', { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId });
    return request;
  }

  // Task 1.15 (VAL-011): approve under row locks so concurrent approvals can't
  // over-draw the balance. The FOR UPDATE locks serialize on the balance row;
  // the PENDING guard prevents a request being approved (and deducted) twice.
  async approveLeave(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const [req] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          employee_id: string;
          leave_type_id: string;
          total_days: number;
          start_date: Date;
        }>
      >`SELECT id, status, employee_id, leave_type_id, total_days, start_date
        FROM leave_requests WHERE id = ${id} FOR UPDATE`;

      if (!req) throw new NotFoundError('Leave request not found');
      if (req.status !== 'PENDING') {
        throw new BadRequestError('Leave request sudah diproses');
      }

      const year = new Date(req.start_date).getFullYear();
      const [bal] = await tx.$queryRaw<
        Array<{ id: string; used_days: number; remaining_days: number }>
      >`SELECT id, used_days, remaining_days FROM leave_balances
        WHERE employee_id = ${req.employee_id} AND leave_type_id = ${req.leave_type_id} AND year = ${year}
        FOR UPDATE`;

      if (!bal || bal.remaining_days < req.total_days) {
        throw new BadRequestError('Leave balance tidak cukup');
      }

      await tx.leaveBalance.update({
        where: { id: bal.id },
        data: {
          usedDays: bal.used_days + req.total_days,
          remainingDays: bal.remaining_days - req.total_days,
        },
      });

      const approved = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      });
      logger.info('Leave approved', { id, employeeId: req.employee_id, days: req.total_days });
      return approved;
    });
  }

  async rejectLeave(id: string, reason?: string) {
    await this.findLeaveRequestById(id);
    return leaveRepository.updateLeaveStatus(id, 'REJECTED', undefined, reason);
  }

  async getLeaveBalances(employeeId: string) {
    return leaveRepository.findLeaveBalances(employeeId);
  }

  async setLeaveBalance(data: CreateLeaveBalanceDTO) {
    return leaveRepository.upsertLeaveBalance(data);
  }
}

export const leaveService = new LeaveService();
