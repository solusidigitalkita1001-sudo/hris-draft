import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { onboardingService } from './onboarding.service';
import { Result } from '@/shared/core/Result';

export class OnboardingController {
  async getChecklists(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await onboardingService.getChecklists(req.query.employeeId as string))); }
    catch (error) { next(error); }
  }
  async createChecklist(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await onboardingService.createChecklist(req.body))); }
    catch (error) { next(error); }
  }
  async updateChecklist(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await onboardingService.updateChecklist(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }
  async findAllResignations(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await onboardingService.findAllResignations(req.query.companyId as string, req.query.status as string))); }
    catch (error) { next(error); }
  }
  async findResignationById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await onboardingService.findResignationById(req.params.id as string))); }
    catch (error) { next(error); }
  }
  async createResignation(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await onboardingService.createResignation(req.body))); }
    catch (error) { next(error); }
  }
  async approveResignation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await onboardingService.approveResignation(req.params.id as string, req.user!.id))); }
    catch (error) { next(error); }
  }
  async rejectResignation(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await onboardingService.rejectResignation(req.params.id as string))); }
    catch (error) { next(error); }
  }
  async updateClearance(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await onboardingService.updateClearance(req.params.id as string, req.body.status, req.body.notes))); }
    catch (error) { next(error); }
  }
  async calculateFinalPayroll(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await onboardingService.calculateFinalPayroll(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }
}
export const onboardingController = new OnboardingController();
