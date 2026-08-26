import { Request, Response, NextFunction } from 'express';
import { dailyActivityService } from './daily-activity.service';
import { getRequestContext } from '@/shared/context/RequestContext';
import type {
  CreateDailyActivityDTO,
  UpdateDailyActivityDTO,
  CompleteDailyActivityDTO,
  ListDailyActivitiesDTO,
} from './daily-activity.dto';

interface UserContextLite {
  id?: string;
  employeeId?: string;
  companyId?: string;
  roles: string[];
}

export class DailyActivityController {
  async listRequests(req: Request<any, any, any, ListDailyActivitiesDTO>, res: Response, next: NextFunction) {
    try {
      const companyId = getRequestContext()?.user?.companyId!;
      const result = await dailyActivityService.findAll(companyId, req.query);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getMyActivities(req: Request<any, any, any, { startDate?: string; endDate?: string }>, res: Response, next: NextFunction) {
    try {
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      if (!ctx?.employeeId) return res.status(400).json({ success: false, message: 'employeeId context tidak ada' });
      const start = req.query.startDate ? new Date(req.query.startDate) : undefined;
      const end = req.query.endDate ? new Date(req.query.endDate) : undefined;
      const result = await dailyActivityService.findMyActivities(ctx.employeeId, start, end);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await dailyActivityService.findById(id);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async createRequest(req: Request<any, any, CreateDailyActivityDTO>, res: Response, next: NextFunction) {
    try {
      const result = await dailyActivityService.createRequest(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async updateRequest(req: Request<any, any, UpdateDailyActivityDTO>, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await dailyActivityService.updateRequest(id, req.body);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async completeRequest(req: Request<any, any, CompleteDailyActivityDTO>, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await dailyActivityService.completeRequest(id, req.body);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async deleteRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await dailyActivityService.deleteRequest(id);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export const dailyActivityController = new DailyActivityController();
