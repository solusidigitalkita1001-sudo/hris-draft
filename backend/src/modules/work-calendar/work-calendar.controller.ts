import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { workCalendarRepository } from './work-calendar.repository';
import { Result } from '@/shared/core/Result';

export class WorkCalendarController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.findAll(req.query.companyId as string);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const calendar = await workCalendarRepository.findById(id);
      if (!calendar) return res.status(404).json(Result.error('Calendar not found'));
      res.json(Result.success(calendar));
    } catch (error) { next(error); }
  }

  async findAllShiftFormulas(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.findAllShiftFormulas(req.query.companyId as string);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findShiftFormulaById(req: Request, res: Response, next: NextFunction) {
    try {
      const formula = await workCalendarRepository.findShiftFormulaById(req.params.sid as string);
      if (!formula) return res.status(404).json(Result.error('Shift formula not found'));
      res.json(Result.success(formula));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.create({ ...req.body, createdBy: req.user!.id });
      res.status(201).json(Result.created(data));
    } catch (error) { next(error); }
  }

  async createShiftFormula(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.createShiftFormula({ ...req.body, createdBy: req.user!.id });
      res.status(201).json(Result.created(data));
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.update(req.params.id as string, req.body);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async updateShiftFormula(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.updateShiftFormula(req.params.sid as string, req.body);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await workCalendarRepository.delete(req.params.id as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  async deleteShiftFormula(req: Request, res: Response, next: NextFunction) {
    try {
      await workCalendarRepository.deleteShiftFormula(req.params.sid as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  async findDays(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const year = Number(req.query.year as string) || new Date().getFullYear();
      const month = Number(req.query.month as string) || (new Date().getMonth() + 1);
      const data = await workCalendarRepository.findDays(id, year, month);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async bulkUpdateDays(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.bulkUpdateDays(req.params.id as string, req.body.days);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async generateDefaultDays(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const calendar = await workCalendarRepository.findById(id);
      if (!calendar) return res.status(404).json(Result.error('Calendar not found'));
      const workDays = calendar.workDays as Record<string, unknown>;
      const data = await workCalendarRepository.generateDefaultDays(id, calendar.year, workDays);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async copyCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { targetYear, name } = req.body;
      const newName = name || `Copy ${targetYear}`;
      const data = await workCalendarRepository.copyCalendar(id, newName, targetYear);
      if (!data) return res.status(404).json(Result.error('Source calendar not found'));
      res.status(201).json(Result.created(data));
    } catch (error) { next(error); }
  }

  async findAllHolidays(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.findAllHolidays(
        req.query.companyId as string,
        req.query.year ? Number(req.query.year) : undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async createHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.createHoliday(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) { next(error); }
  }

  async updateHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.updateHoliday(req.params.hid as string, req.body);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async deleteHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      await workCalendarRepository.deleteHoliday(req.params.hid as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }

  async countWorkingDays(req: Request, res: Response, next: NextFunction) {
    try {
      const calendarId = req.query.calendarId as string;
      const start = req.query.start as string;
      const end = req.query.end as string;
      const count = await workCalendarRepository.countWorkingDays(calendarId, new Date(start), new Date(end));
      res.json(Result.success({ count }));
    } catch (error) { next(error); }
  }

  async getEmployeeCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const calendar = await workCalendarRepository.findEmployeeCalendar(req.params.employeeId as string);
      if (!calendar) return res.status(404).json(Result.error('No calendar found for employee'));
      res.json(Result.success(calendar));
    } catch (error) { next(error); }
  }

  async getMyResolvedCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const year = Number(req.query.year as string) || new Date().getFullYear();
      const month = Number(req.query.month as string) || (new Date().getMonth() + 1);
      const data = await workCalendarRepository.findResolvedMyWorkCalendarMonth(req.user!.id, year, month);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findShiftSwapCandidates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.findShiftSwapCandidatesForUser(
        req.user!.id,
        req.query.shiftDate as string | undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findMyShiftSwapRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.findMyShiftSwapRequests(
        req.user!.id,
        req.query.status as string | undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findMyShiftSwapApprovals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.findMyShiftSwapApprovals(
        req.user!.id,
        req.query.status as string | undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async createShiftSwapRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.createShiftSwapRequest(req.user!.id, req.body);
      res.status(201).json(Result.created(data));
    } catch (error) { next(error); }
  }

  async cancelShiftSwapRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await workCalendarRepository.cancelShiftSwapRequest(req.user!.id, req.params.requestId as string);
      res.json(Result.success(null, 'Request tukar shift dibatalkan'));
    } catch (error) { next(error); }
  }

  async approveShiftSwapRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.approveShiftSwapRequest(req.user!.id, req.params.requestId as string, req.body);
      res.json(Result.updated(data, 'Request tukar shift disetujui'));
    } catch (error) { next(error); }
  }

  async rejectShiftSwapRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workCalendarRepository.rejectShiftSwapRequest(req.user!.id, req.params.requestId as string, req.body);
      res.json(Result.updated(data, 'Request tukar shift ditolak'));
    } catch (error) { next(error); }
  }

  async getTeamCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const year = Number(req.query.year as string) || new Date().getFullYear();
      const month = Number(req.query.month as string) || (new Date().getMonth() + 1);
      const data = await workCalendarRepository.findTeamCalendar(
        req.params.managerId as string,
        req.query.companyId as string,
        year,
        month,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }
}

export const workCalendarController = new WorkCalendarController();
