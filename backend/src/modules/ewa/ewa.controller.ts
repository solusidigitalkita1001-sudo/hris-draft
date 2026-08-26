import { Request, Response, NextFunction } from 'express';
import { ewaService } from './ewa.service';
import { getRequestContext, getCurrentCompanyId, getCurrentRoles } from '@/shared/context/RequestContext';
import type { ListEWARequestsDTO, CreateEWARequestDTO, ApproveEWARequestDTO, RejectEWARequestDTO, MarkPaidEWARequestDTO } from './ewa.dto';

interface UserContextLite {
  id?: string;
  employeeId?: string;
  companyId?: string;
  roles: string[];
}

export class EWAController {
  async listRequests(req: Request<any, any, any, ListEWARequestsDTO>, res: Response, next: NextFunction) {
    try {
      const companyId = getCurrentCompanyId()!;
      const result = await ewaService.findAll(companyId, {
        status: req.query.status,
        employeeId: req.query.employeeId,
      });
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getMyRequests(req: Request<any, any, any, ListEWARequestsDTO>, res: Response, next: NextFunction) {
    try {
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      if (!ctx?.employeeId) return res.status(400).json({ success: false, message: 'employeeId context tidak ada' });
      const result = await ewaService.findMyRequests(ctx.employeeId, req.query.status);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ewaService.findById(id);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async createRequest(req: Request<any, any, CreateEWARequestDTO & { earnedGross: number; periodStart: string; periodEnd: string }>, res: Response, next: NextFunction) {
    try {
      const payload = { ...req.body, periodStart: new Date(req.body.periodStart), periodEnd: new Date(req.body.periodEnd) };
      const result = await ewaService.createRequest(payload);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async approveRequest(req: Request<any, any, ApproveEWARequestDTO>, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      const result = await ewaService.approveRequest(id, ctx?.id ?? 'system', req.body);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async rejectRequest(req: Request<any, any, RejectEWARequestDTO>, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      const result = await ewaService.rejectRequest(id, ctx?.id ?? 'system', req.body);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async cancelRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      const result = await ewaService.cancelRequest(id, ctx?.id ?? 'system');
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async markPaid(req: Request<any, any, MarkPaidEWARequestDTO>, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      const result = await ewaService.markPaid(id, ctx?.id ?? 'system', req.body);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }

  async getMyLimit(req: Request<any, any, any, { earnedGross?: string; percent?: string }>, res: Response, next: NextFunction) {
    try {
      const earnedGross = Number(req.query.earnedGross ?? 0);
      const percent = req.query.percent ? Number(req.query.percent) : undefined;
      const result = ewaService.calcMaxAllowed(earnedGross, percent);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export const ewaController = new EWAController();
