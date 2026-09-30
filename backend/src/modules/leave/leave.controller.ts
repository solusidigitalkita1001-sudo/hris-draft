import { Response, NextFunction } from 'express';
import { collectiveLeaveService } from './collective-leave.service';
import { leaveEncashmentService } from './leave-encashment.service';
import type { EncashmentQueryDTO, RejectEncashmentDTO, RequestEncashmentDTO } from './leave-encashment.dto';
import type { CollectiveLeaveQueryDTO, DeclareCollectiveLeaveDTO } from './collective-leave.dto';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { leaveService } from './leave.service';
import { Result } from '@/shared/core/Result';
import { runYearlyLeaveAccrual } from './leave.scheduler';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { LEAVE_ATTACHMENT_URL_PREFIX, leaveAttachmentOwnerDirectory } from '@/shared/storage/leave-attachment-reference';
import config from '@/config';

function activeCompanyId(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class LeaveController {
  async findAllLeaveTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.findAllLeaveTypes(req.query.companyId as string))); }
    catch (error) { next(error); }
  }

  async createLeaveType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.createLeaveType(req.body))); }
    catch (error) { next(error); }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await leaveService.findAllLeaveRequests(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        status: req.query.status as string,
        leaveTypeId: req.query.leaveTypeId as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.findLeaveRequestById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.employeeId) req.body.employeeId = req.user.employeeId;
      res.status(201).json(Result.created(await leaveService.createLeaveRequest(req.body)));
    } catch (error) { next(error); }
  }

  async uploadAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestError('File lampiran wajib diunggah');
      }
      const ownerDirectory = leaveAttachmentOwnerDirectory(req.user?.companyId, req.user?.employeeId);
      const attachmentUrl = `${config.app.url}${LEAVE_ATTACHMENT_URL_PREFIX}${ownerDirectory}/${req.file.filename}`;
      res.status(201).json(
        Result.created(
          {
            fileName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            url: attachmentUrl,
          },
          'Lampiran cuti berhasil diunggah'
        )
      );
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.approveLeave(req.params.id as string, req.user!.id, req.user!.employeeId);
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.rejectLeave(req.params.id as string, req.body.reason, req.user!.employeeId);
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.cancelLeave(req.params.id as string, req.user!.id, req.user!.employeeId);
      res.json(Result.updated(result, 'Pengajuan cuti dibatalkan'));
    } catch (error) { next(error); }
  }

  async getWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await leaveService.getLeaveWorkflow(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async applyWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.applyWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' }
      );
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async getBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.getLeaveBalances(req.query.employeeId as string))); }
    catch (error) { next(error); }
  }

  async setBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.setLeaveBalance(req.body))); }
    catch (error) { next(error); }
  }

  async triggerYearlyAccrual(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const year = req.body.year ?? new Date().getFullYear();
      const result = await runYearlyLeaveAccrual(year);
      res.json(Result.success(result));
    } catch (error) { next(error); }
  }

  // ==================== Cuti bersama (collective leave) ====================
  async declareCollectiveLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = activeCompanyId(req);
      const declaration = await collectiveLeaveService.declare(companyId, req.body as DeclareCollectiveLeaveDTO);
      res.status(201).json(
        Result.success(
          declaration,
          'Cuti bersama dideklarasikan. Belum ada saldo yang dipotong — periksa dampaknya lewat /preview, lalu terapkan.',
        ),
      );
    } catch (error) { next(error); }
  }

  async findAllCollectiveLeaves(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as CollectiveLeaveQueryDTO;
      res.json(Result.success(await collectiveLeaveService.list(activeCompanyId(req), query)));
    } catch (error) { next(error); }
  }

  /** Who the day would affect, and how, before anything is written. */
  async previewCollectiveLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const plan = await collectiveLeaveService.plan(activeCompanyId(req), String(req.params.id));
      const tally = plan.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.outcome] = (acc[entry.outcome] ?? 0) + 1;
        return acc;
      }, {});
      res.json(Result.success({ total: plan.length, tally, employees: plan }));
    } catch (error) { next(error); }
  }

  async applyCollectiveLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await collectiveLeaveService.apply(activeCompanyId(req), String(req.params.id));
      res.json(Result.success(result, 'Cuti bersama diterapkan'));
    } catch (error) { next(error); }
  }

  async cancelCollectiveLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await collectiveLeaveService.cancel(activeCompanyId(req), String(req.params.id))));
    } catch (error) { next(error); }
  }

  // ==================== Pencairan sisa cuti (encashment) ====================
  /** What the company's policy currently allows, so the UI can explain itself. */
  async encashmentPolicy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await leaveEncashmentService.describePolicy(activeCompanyId(req))));
    } catch (error) { next(error); }
  }

  async requestEncashment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const row = await leaveEncashmentService.request(activeCompanyId(req), req.body as RequestEncashmentDTO);
      res.status(201).json(
        Result.success(
          { id: row.id, days: row.days, grossAmount: row.grossAmount, status: row.status, basis: row.basis },
          'Pengajuan pencairan cuti dibuat. Saldo cuti baru dipotong saat disetujui.',
        ),
      );
    } catch (error) { next(error); }
  }

  async findAllEncashments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as EncashmentQueryDTO;
      res.json(Result.success(await leaveEncashmentService.list(activeCompanyId(req), query)));
    } catch (error) { next(error); }
  }

  async approveEncashment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(
        await leaveEncashmentService.approve(activeCompanyId(req), String(req.params.id)),
        'Disetujui. Saldo cuti dipotong sekarang; nominalnya dibayar pada run payroll berikutnya.',
      ));
    } catch (error) { next(error); }
  }

  async rejectEncashment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as RejectEncashmentDTO;
      res.json(Result.success(await leaveEncashmentService.reject(activeCompanyId(req), String(req.params.id), reason)));
    } catch (error) { next(error); }
  }
}

export const leaveController = new LeaveController();
