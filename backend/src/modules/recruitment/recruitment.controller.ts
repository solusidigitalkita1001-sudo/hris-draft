import { Request, Response, NextFunction } from 'express';
import { recruitmentService } from './recruitment.service';
import { Result } from '@/shared/core/Result';

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
}

export const recruitmentController = new RecruitmentController();
