import prisma from '@/shared/database/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { attendanceCorrectionRepository } from './attendance-correction.repository';
import { CreateAttendanceCorrectionDTO } from './attendance-correction.dto';
import { assertPayrollDateOpen } from '@/shared/payroll/payroll-period-guard';
import { attendanceContextService } from './attendance-context.service';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import { getRequestContext } from '@/shared/context/RequestContext';

class AttendanceCorrectionService {
  findAll(companyId: string, filters?: { employeeId?: string; status?: string }) {
    return attendanceCorrectionRepository.findAll(companyId, filters);
  }

  async findById(id: string) {
    const correction = await attendanceCorrectionRepository.findById(id);
    if (!correction) throw new NotFoundError('Attendance correction not found');
    return correction;
  }

  async create(data: CreateAttendanceCorrectionDTO) {
    if (!data.requestedCheckIn && !data.requestedCheckOut) {
      throw new BadRequestError('Minimal satu dari requestedCheckIn atau requestedCheckOut harus diisi');
    }
    await assertPayrollDateOpen(data.companyId, new Date(data.date));
    const correction = await attendanceCorrectionRepository.create(data);
    // Route through the workflow engine when a template exists (unified inbox,
    // delegation, SLA). Compensation on start failure keeps it approvable.
    try {
      const template = await workflowEngineRepository.findDefaultTemplate(data.companyId, 'ATTENDANCE_CORRECTION', 'attendance');
      if (template) {
        await workflowEngineRepository.startInstance(getRequestContext()?.user?.id ?? 'system', {
          templateId: template.id,
          companyId: data.companyId,
          approvalType: 'ATTENDANCE_CORRECTION',
          referenceType: 'ATTENDANCE_CORRECTION',
          referenceId: correction.id,
          payload: { employeeId: data.employeeId, date: data.date, companyId: data.companyId },
        });
      }
    } catch (wfErr) {
      await prisma.attendanceCorrection.delete({ where: { id: correction.id } }).catch(() => undefined);
      throw new BadRequestError('Pengajuan koreksi gagal: workflow approval tidak dapat dimulai. Coba lagi atau hubungi admin.');
    }
    logger.info('Attendance correction created', { id: correction.id, employeeId: data.employeeId });
    return correction;
  }

  /** Workflow-driven approve/reject (centralized approval). */
  async applyWorkflowAction(
    id: string,
    userId: string,
    roles: string[],
    action: { action: 'APPROVE' | 'REJECT' | 'ESCALATE'; comment?: string },
    approverEmployeeId?: string | null,
  ) {
    const correction = await this.findById(id);
    const instance = await prisma.workflowInstance.findFirst({
      where: { referenceType: 'ATTENDANCE_CORRECTION', referenceId: id },
    });
    if (!instance) throw new NotFoundError('Workflow instance not found for this correction');
    const updated = await workflowEngineRepository.applyAction(instance.id, userId, roles, action);
    if (!updated) throw new NotFoundError('Failed to update workflow instance');
    if (updated.status === 'APPROVED') {
      await this.approve(id, userId, approverEmployeeId);
    }
    if (action.action === 'REJECT') {
      await this.reject(id, approverEmployeeId, action.comment);
    }
    return { correction: await this.findById(id), workflowInstance: updated };
  }

  async approve(id: string, approverUserId: string, approverEmployeeId?: string | null) {
    const correction = await this.findById(id);
    if (approverEmployeeId && approverEmployeeId === correction.employeeId) {
      throw new ForbiddenError('Cannot approve your own attendance correction');
    }
    if (correction.status !== 'PENDING') {
      throw new BadRequestError('Koreksi absensi sudah diproses');
    }

    // The attendance this correction lands on may sit in a period that was
    // reviewed/closed AFTER the request was filed — re-check at approval.
    await assertPayrollDateOpen(correction.companyId, new Date(correction.date));

    // Resolve calendar/policy context so a fabricated row cannot land on a
    // non-working day and carries the same provenance as a normal clock-in.
    const context = await attendanceContextService.resolve(
      correction.employeeId,
      new Date(correction.date),
      correction.companyId,
    );
    if (!correction.attendanceId && !context.schedule.isWorkingDay) {
      throw new BadRequestError('Tanggal koreksi bukan hari kerja menurut kalender karyawan');
    }

    const deriveTimes = (checkIn?: Date | null, checkOut?: Date | null) => {
      if (checkIn && checkOut && checkOut.getTime() <= checkIn.getTime()) {
        throw new BadRequestError('Jam pulang koreksi harus setelah jam masuk');
      }
      return checkIn && checkOut
        ? { workDuration: Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) }
        : {};
    };

    await prisma.$transaction(async (tx) => {
      // Apply the correction to the attendance record
      if (correction.attendanceId) {
        const before = await tx.attendance.findUnique({
          where: { id: correction.attendanceId },
          select: { checkIn: true, checkOut: true, status: true },
        });
        const nextCheckIn = correction.requestedCheckIn ?? before?.checkIn ?? null;
        const nextCheckOut = correction.requestedCheckOut ?? before?.checkOut ?? null;
        await tx.attendance.update({
          where: { id: correction.attendanceId },
          data: {
            ...(correction.requestedCheckIn && { checkIn: correction.requestedCheckIn }),
            ...(correction.requestedCheckOut && { checkOut: correction.requestedCheckOut }),
            status: 'PRESENT',
            ...deriveTimes(nextCheckIn, nextCheckOut),
          },
        });
        await tx.attendanceCorrection.update({
          where: { id },
          data: {
            beforeCheckIn: before?.checkIn ?? null,
            beforeCheckOut: before?.checkOut ?? null,
            beforeStatus: before?.status ?? null,
          },
        });
      } else {
        // No existing record — create one with full provenance for the date.
        await tx.attendance.upsert({
          where: { employeeId_date: { employeeId: correction.employeeId, date: correction.date } },
          create: {
            employeeId: correction.employeeId,
            companyId: correction.companyId,
            branchId: context.branchId,
            resolvedCalendarId: context.calendarId,
            attendancePolicyId: context.policy.id ?? undefined,
            date: correction.date,
            checkIn: correction.requestedCheckIn ?? undefined,
            checkOut: correction.requestedCheckOut ?? undefined,
            status: 'PRESENT',
            method: 'MANUAL',
            ...deriveTimes(correction.requestedCheckIn, correction.requestedCheckOut),
          },
          update: {
            ...(correction.requestedCheckIn && { checkIn: correction.requestedCheckIn }),
            ...(correction.requestedCheckOut && { checkOut: correction.requestedCheckOut }),
            status: 'PRESENT',
            ...deriveTimes(correction.requestedCheckIn, correction.requestedCheckOut),
          },
        });
      }

      await tx.attendanceCorrection.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: approverUserId, approvedAt: new Date() },
      });
    });

    logger.info('Attendance correction approved', { id, approvedBy: approverUserId });
    return this.findById(id);
  }

  async reject(id: string, approverEmployeeId?: string | null, rejectionReason?: string) {
    const correction = await this.findById(id);
    if (approverEmployeeId && approverEmployeeId === correction.employeeId) {
      throw new ForbiddenError('Cannot reject your own attendance correction');
    }
    if (correction.status !== 'PENDING') {
      throw new BadRequestError('Koreksi absensi sudah diproses');
    }
    await attendanceCorrectionRepository.updateStatus(id, 'REJECTED', { rejectionReason });
    logger.info('Attendance correction rejected', { id });
    return this.findById(id);
  }
}

export const attendanceCorrectionService = new AttendanceCorrectionService();
