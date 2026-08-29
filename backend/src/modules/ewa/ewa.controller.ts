import { Request, Response, NextFunction } from 'express';
import { ewaService } from './ewa.service';
import { getRequestContext, getCurrentCompanyId } from '@/shared/context/RequestContext';
import type { ListEWARequestsDTO, CreateEWARequestDTO, ApproveEWARequestDTO, RejectEWARequestDTO, MarkPaidEWARequestDTO } from './ewa.dto';
import { BadRequestError } from '@/shared/exceptions/AppError';

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

  /**
   * EWA Create:
   * HANYA terima payload CREATE_EWA_REQUEST_SCHEMA zod (employeeId?, payrollPeriodId?, amountRequested, adminFee?, reason?).
   *
   * FIELDS YANG TIDAK BOLEH DATANG DARI CLIENT (server-side enforced):
   *   - earnedGross → server hitung dari baseSalary + attendance present days + approved overtime.
   *   - periodStart/periodEnd → server ambil dari PayrollPeriod DB (payrollPeriodId) atau fallback awal-akhir bulan ini.
   *   - companyId → dari context request (AUTHED user, BUKAN client body).
   */
  async createRequest(req: Request<any, any, CreateEWARequestDTO>, res: Response, next: NextFunction) {
    try {
      if ((req.body as any).earnedGross !== undefined) {
        throw new BadRequestError('Field earnedGross TIDAK BOLEH dikirim dari client — server akan menghitung sendiri pendapatan Anda berdasarkan data attendance dan salary aktual. Hapus earnedGross dari request body.');
      }
      if ((req.body as any).periodStart !== undefined || (req.body as any).periodEnd !== undefined) {
        throw new BadRequestError('Field periodStart/periodEnd TIDAK BOLEH dikirim dari client. Gunakan payrollPeriodId yang terdaftar (atau kosongkan untuk auto-detect bulan ini). Hapus periodStart/periodEnd dari request body.');
      }
      const result = await ewaService.createRequest(req.body);
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

  /**
   * getMyLimit V2 (server-side enforcement):
   * TIDAK LAGI accept query ?earnedGross=... dari client (biar tidak bisa di-setting sembarang).
   * Hanya accept optional ?percent=<1-100> untuk override max percent (batas 100).
   */
  async getMyLimit(req: Request<any, any, any, { earnedGross?: string; percent?: string }>, res: Response, next: NextFunction) {
    try {
      if (req.query.earnedGross !== undefined) {
        throw new BadRequestError('Query parameter earnedGross TIDAK BOLEH dikirim. Server menghitung sendiri limit dari salary + attendance + overtime aktual. Hapus query earnedGross.');
      }
      const ctx = getRequestContext()?.user as UserContextLite | undefined;
      if (!ctx?.employeeId) return res.status(400).json({ success: false, message: 'employeeId context tidak ada' });
      const companyId = getCurrentCompanyId() ?? ctx.companyId;
      if (!companyId) return res.status(400).json({ success: false, message: 'companyId context tidak ada' });

      let percent: number | undefined;
      if (req.query.percent !== undefined) {
        percent = Number(req.query.percent);
        if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
          throw new BadRequestError('Parameter percent (jika dikirim) harus numeric antara 1-100');
        }
      }

      const result = await ewaService.getMyLimitServer(companyId, ctx.employeeId, percent);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  }
}

export const ewaController = new EWAController();
