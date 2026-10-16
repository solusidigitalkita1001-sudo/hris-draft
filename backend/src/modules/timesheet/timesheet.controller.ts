import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { timesheetService } from './timesheet.service';
import type {
  CreateEntryDTO, CreateProjectDTO, EntriesQueryDTO, MyEntriesQueryDTO,
  ReportQueryDTO, UpdateEntryDTO, UpdateProjectDTO,
} from './timesheet.dto';

function companyOf(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

function employeeOf(req: AuthenticatedRequest): string {
  const employeeId = req.user?.employeeId;
  if (!employeeId) throw new BadRequestError('Akun ini tidak tertaut ke data karyawan');
  return employeeId;
}

export class TimesheetController {
  async listProjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.listProjects(companyOf(req), req.query.includeInactive === 'true')));
    } catch (error) { next(error); }
  }

  async createProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.success(await timesheetService.createProject(companyOf(req), req.body as CreateProjectDTO)));
    } catch (error) { next(error); }
  }

  async updateProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.updateProject(companyOf(req), String(req.params.id), req.body as UpdateProjectDTO)));
    } catch (error) { next(error); }
  }

  async createEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const row = await timesheetService.createEntry(companyOf(req), employeeOf(req), req.body as CreateEntryDTO);
      res.status(201).json(Result.success(row));
    } catch (error) { next(error); }
  }

  async listMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.listMine(companyOf(req), employeeOf(req), req.query as unknown as MyEntriesQueryDTO)));
    } catch (error) { next(error); }
  }

  async updateMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.updateMine(companyOf(req), employeeOf(req), String(req.params.id), req.body as UpdateEntryDTO)));
    } catch (error) { next(error); }
  }

  async deleteMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.deleteMine(companyOf(req), employeeOf(req), String(req.params.id))));
    } catch (error) { next(error); }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.list(companyOf(req), req.query as unknown as EntriesQueryDTO)));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.decide(companyOf(req), String(req.params.id), String(req.user?.id), 'APPROVED', req.user?.employeeId)));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.decide(companyOf(req), String(req.params.id), String(req.user?.id), 'REJECTED', req.user?.employeeId)));
    } catch (error) { next(error); }
  }

  async report(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await timesheetService.report(companyOf(req), req.query as unknown as ReportQueryDTO)));
    } catch (error) { next(error); }
  }
}

export const timesheetController = new TimesheetController();
