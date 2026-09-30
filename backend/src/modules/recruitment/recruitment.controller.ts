import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { jobRequisitionService } from './job-requisition.service';
import type { CreateJobRequisitionDTO, RejectRequisitionDTO, RequisitionQueryDTO } from './recruitment.dto';
import { recruitmentService } from './recruitment.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';

function activeCompanyId(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class RecruitmentController {
  async findAllJobPostings(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findAllJobPostings(req.query.companyId as string, req.query.status as string))); }
    catch (error) { next(error); }
  }

  async findJobPostingById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findJobPostingById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async createJobPosting(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await recruitmentService.createJobPosting(req.body))); }
    catch (error) { next(error); }
  }

  async approveJobPosting(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await recruitmentService.approveJobPosting(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async closeJobPosting(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await recruitmentService.closeJobPosting(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async findAllCandidates(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findAllCandidates(req.query.companyId as string))); }
    catch (error) { next(error); }
  }

  async findCandidateById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findCandidateById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async createCandidate(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await recruitmentService.createCandidate(req.body))); }
    catch (error) { next(error); }
  }

  async findAllApplications(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findAllApplications(req.query.companyId as string, req.query.jobPostingId as string))); }
    catch (error) { next(error); }
  }

  async createApplication(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await recruitmentService.createApplication(req.body))); }
    catch (error) { next(error); }
  }

  async updateApplicationStatus(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await recruitmentService.updateApplicationStatus(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async findAllInterviews(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findAllInterviews(req.query.companyId as string))); }
    catch (error) { next(error); }
  }

  async createInterview(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await recruitmentService.createInterview(req.body))); }
    catch (error) { next(error); }
  }

  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try { const interviewId = req.params.id as string; res.status(201).json(Result.created(await recruitmentService.submitFeedback(interviewId, req.body))); }
    catch (error) { next(error); }
  }

  async findOffers(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await recruitmentService.findOffers(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async createOffer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await recruitmentService.createOffer(req.params.id as string, req.body, req.user!.id))); }
    catch (error) { next(error); }
  }

  async approveOffer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await recruitmentService.approveOffer(req.params.id as string, req.user!.id))); }
    catch (error) { next(error); }
  }

  async respondOffer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await recruitmentService.respondOffer(req.params.id as string, req.body.decision, req.body.notes))); }
    catch (error) { next(error); }
  }

  // ==================== Requisition (man power planning) ====================
  async createRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = activeCompanyId(req);
      res.status(201).json(Result.success(
        await jobRequisitionService.create(companyId, req.body as CreateJobRequisitionDTO),
        'Requisition dibuat sebagai DRAFT. Ajukan untuk disetujui sebelum lowongan dibuka.',
      ));
    } catch (error) { next(error); }
  }

  async findAllRequisitions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as RequisitionQueryDTO;
      const companyId = activeCompanyId(req);
      res.json(Result.success({
        required: await jobRequisitionService.isRequired(companyId),
        requisitions: await jobRequisitionService.list(companyId, query),
      }));
    } catch (error) { next(error); }
  }

  async submitRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await jobRequisitionService.submit(activeCompanyId(req), String(req.params.id))));
    } catch (error) { next(error); }
  }

  async approveRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await jobRequisitionService.approve(activeCompanyId(req), String(req.params.id))));
    } catch (error) { next(error); }
  }

  async rejectRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as RejectRequisitionDTO;
      res.json(Result.success(await jobRequisitionService.reject(activeCompanyId(req), String(req.params.id), reason)));
    } catch (error) { next(error); }
  }

  async cancelRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await jobRequisitionService.cancel(activeCompanyId(req), String(req.params.id))));
    } catch (error) { next(error); }
  }
}

export const recruitmentController = new RecruitmentController();
