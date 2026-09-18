import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { attendanceService } from './attendance.service';
import { Result } from '@/shared/core/Result';
import { BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';

export class AttendanceController {
  async findMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.employeeId || !req.user.companyId) {
        throw new BadRequestError('Akun ini tidak tertaut ke data karyawan dan perusahaan');
      }
      const { month, page, limit } = req.query as unknown as {
        month?: string;
        page: number;
        limit: number;
      };
      const result = await attendanceService.findMyAttendance(
        req.user.employeeId,
        req.user.companyId,
        { month, page, limit },
      );
      res.setHeader('X-Office-Timezone', result.timezone);
      res.setHeader('X-Server-Date', result.serverDate);
      res.json(Result.paginated(result.items, result.total, page, limit));
    } catch (error) { next(error); }
  }

  async getMyToday(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.employeeId || !req.user.companyId) {
        throw new BadRequestError('Akun ini tidak tertaut ke data karyawan dan perusahaan');
      }
      res.json(Result.success(await attendanceService.getMyToday(req.user.employeeId, req.user.companyId)));
    } catch (error) { next(error); }
  }

  async checkInSelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.employeeId || !req.user.companyId) {
        throw new BadRequestError('Akun ini tidak tertaut ke data karyawan dan perusahaan');
      }
      res.status(201).json(Result.created(
        await attendanceService.checkInSelf(req.user.employeeId, req.user.companyId, req.body),
      ));
    } catch (error) { next(error); }
  }

  async checkOutSelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.employeeId || !req.user.companyId) {
        throw new BadRequestError('Akun ini tidak tertaut ke data karyawan dan perusahaan');
      }
      res.json(Result.updated(
        await attendanceService.checkOutSelf(req.user.employeeId, req.user.companyId, req.body),
      ));
    } catch (error) { next(error); }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.findAll(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        date: req.query.date as string,
        month: req.query.month as string,
        status: req.query.status as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await attendanceService.findById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // [Finding #10 / #8 T3.3] Ownership guard as a POSITIVE capability gate:
      // only explicitly elevated roles may clock-in on behalf of another
      // employee. Any other role — including custom roles that carry neither the
      // EMPLOYEE role nor an elevated one — is forced to self, closing the gap
      // where a non-listed role could set an arbitrary employeeId.
      const canManageOthersAttendance = req.user?.roles?.some((r: string) =>
        ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'BRANCH_MANAGER', 'MANAGER'].includes(r)
      ) ?? false;
      if (!canManageOthersAttendance) {
        if (req.body.employeeId && req.body.employeeId !== req.user?.employeeId) {
          throw new ForbiddenError('Anda tidak boleh clock-in atas nama karyawan lain');
        }
        if (req.user?.employeeId) {
          req.body.employeeId = req.user.employeeId;
        }
      }
      res.status(201).json(Result.created(await attendanceService.create(req.body)));
    } catch (error) { next(error); }
  }

  async getContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.getResolvedContext(
        req.query.employeeId as string,
        req.query.date as string,
        req.query.companyId as string | undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.checkOut(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { await attendanceService.delete(req.params.id as string); res.json(Result.deleted()); }
    catch (error) { next(error); }
  }

  async correction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.correction(req.params.id as string, req.body);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { companyId, month, year } = req.query as { companyId: string; month: string; year: string };
      const data = await attendanceService.getSummary(companyId, month, year);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async getReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { companyId, month, year } = req.query as { companyId: string; month: string; year: string };
      const csv = await attendanceService.getReport(companyId, month, year);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${month}-${year}.csv"`);
      res.send(csv);
    } catch (error) { next(error); }
  }

  // Overtime
  async findAllOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const canReadOthers = req.user?.roles?.some((role) =>
        ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(role)
      ) ?? false;
      const employeeId = canReadOthers
        ? req.query.employeeId as string
        : req.user?.employeeId;
      if (!employeeId && !canReadOthers) throw new BadRequestError('Akun ini tidak tertaut ke data karyawan');
      const data = await attendanceService.findAllOvertime(req.query.companyId as string, {
        employeeId,
        status: req.query.status as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async createOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const canManageOthers = req.user?.roles?.some((role) =>
        ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(role)
      ) ?? false;
      if (!canManageOthers || !req.body.employeeId) {
        if (!req.user?.employeeId) throw new BadRequestError('Akun ini tidak tertaut ke data karyawan');
        req.body.employeeId = req.user.employeeId;
      }
      if (!req.user?.companyId) throw new BadRequestError('Tidak ada konteks perusahaan aktif');
      req.body.companyId = req.user.companyId;
      res.status(201).json(Result.created(await attendanceService.createOvertime(req.body)));
    }
    catch (error) { next(error); }
  }

  async approveOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.approveOvertime(req.params.id as string, req.user!.id))); }
    catch (error) { next(error); }
  }

  async rejectOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.rejectOvertime(req.params.id as string, req.body.reason))); }
    catch (error) { next(error); }
  }

  async getOvertimeWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await attendanceService.getOvertimeWorkflow(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async applyOvertimeWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.applyOvertimeWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' },
      );
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async calculateOvertimePay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dayType = req.query.dayType === 'HOLIDAY' ? 'HOLIDAY' : 'WORKDAY';
      const workweekDays = req.query.workweekDays === '6' ? 6 : 5;
      res.json(Result.success(await attendanceService.calculateOvertimePay(req.params.id as string, { dayType, workweekDays })));
    } catch (error) { next(error); }
  }
}

export const attendanceController = new AttendanceController();
