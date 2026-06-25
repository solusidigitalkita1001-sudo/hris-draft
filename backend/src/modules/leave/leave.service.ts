import { leaveRepository } from './leave.repository';
import { CreateLeaveTypeDTO, CreateLeaveRequestDTO, CreateLeaveBalanceDTO } from './leave.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

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

  async approveLeave(id: string, userId: string) {
    await this.findLeaveRequestById(id);
    const approved = await leaveRepository.updateLeaveStatus(id, 'APPROVED', userId);

    // Update balance
    const request = await leaveRepository.findLeaveRequestById(id);
    if (request) {
      const balance = await leaveRepository.findLeaveBalances(request.employeeId);
      const bal = balance.find((b) => b.leaveTypeId === request.leaveTypeId);
      if (bal) {
        await leaveRepository.upsertLeaveBalance({
          employeeId: request.employeeId,
          companyId: request.companyId,
          leaveTypeId: request.leaveTypeId,
          year: request.startDate.getFullYear(),
          totalDays: bal.totalDays,
        });
      }
    }

    return approved;
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
