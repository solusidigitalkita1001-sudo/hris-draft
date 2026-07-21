import { Request, Response, NextFunction } from 'express';
import { performanceService } from './performance.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { ForbiddenError } from '@/shared/exceptions/AppError';

export class PerformanceController {
  private getAuditContext(req: AuthenticatedRequest) {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    return {
      userId: req.user.id,
      companyId: req.user.companyId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  async findAllMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findAllMethods(companyId)));
    } catch (error) { next(error); }
  }

  async findMethodById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findMethodById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createMethod(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updateMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateMethod(req.params.id as string, req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async findMethodVersions(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findMethodVersions(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async findMethodVersionById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findMethodVersionById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createMethodVersion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createMethodVersion(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async updateMethodVersion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateMethodVersion(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async publishMethodVersion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.publishMethodVersion(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async findReviewWorkflowTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findReviewWorkflowTemplates(companyId)));
    } catch (error) { next(error); }
  }

  async findReviewWorkflowTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findReviewWorkflowTemplateById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createReviewWorkflowTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createReviewWorkflowTemplate(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updateReviewWorkflowTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateReviewWorkflowTemplate(req.params.id as string, req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async findApprovalWorkflowTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findApprovalWorkflowTemplates(companyId)));
    } catch (error) { next(error); }
  }

  async findApprovalWorkflowTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findApprovalWorkflowTemplateById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createApprovalWorkflowTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createApprovalWorkflowTemplate(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updateApprovalWorkflowTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateApprovalWorkflowTemplate(req.params.id as string, req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async findAllFormulas(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findAllFormulas(companyId)));
    } catch (error) { next(error); }
  }

  async findFormulaById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findFormulaById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createFormula(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createFormula(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updateFormula(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateFormula(req.params.id as string, req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async findAllIndicators(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findAllIndicators(companyId)));
    } catch (error) { next(error); }
  }

  async findIndicatorById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findIndicatorById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createIndicator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createIndicator(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updateIndicator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateIndicator(req.params.id as string, req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async findAllGradeRules(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findAllGradeRules(companyId)));
    } catch (error) { next(error); }
  }

  async findGradeRuleById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findGradeRuleById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createGradeRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createGradeRule(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updateGradeRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateGradeRule(req.params.id as string, req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async findComponentsByMethodVersion(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findComponentsByMethodVersion(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createComponent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createComponent(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async updateComponent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateComponent(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async findAllPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.findAllPeriods(companyId, {
        methodId: req.query.methodId as string,
        status: req.query.status as string,
      })));
    } catch (error) { next(error); }
  }

  async findPeriodById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.findPeriodById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createPeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createPeriod(req.body, this.getAuditContext(req))));
    } catch (error) { next(error); }
  }

  async updatePeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updatePeriod(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getPeriodReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getPeriodReadiness(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async publishPeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.publishPeriod(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async findAllCycles(req: Request, res: Response, next: NextFunction) {
    try { const companyId = req.query.companyId as string; res.json(Result.success(await performanceService.findAllCycles(companyId))); }
    catch (error) { next(error); }
  }

  async createCycle(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.createCycle(req.body))); }
    catch (error) { next(error); }
  }

  async findAllReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const filters = { employeeId: req.query.employeeId as string, cycleId: req.query.cycleId as string, status: req.query.status as string };
      res.json(Result.success(await performanceService.findAllReviews(companyId, filters)));
    } catch (error) { next(error); }
  }

  async findReviewById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await performanceService.findReviewById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async createReview(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.createReview(req.body))); }
    catch (error) { next(error); }
  }

  async submitReview(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await performanceService.submitReview(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async approveReview(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await performanceService.approveReview(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async findAllGoals(req: Request, res: Response, next: NextFunction) {
    try { const companyId = req.query.companyId as string; const eid = req.query.employeeId as string; res.json(Result.success(await performanceService.findAllGoals(companyId, eid))); }
    catch (error) { next(error); }
  }

  async createGoal(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.createGoal(req.body))); }
    catch (error) { next(error); }
  }

  async updateGoalProgress(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await performanceService.updateGoalProgress(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async getFeedbackRequests(req: Request, res: Response, next: NextFunction) {
    try { const companyId = req.query.companyId as string; const rid = req.query.recipientId as string; res.json(Result.success(await performanceService.getFeedbackRequests(companyId, rid))); }
    catch (error) { next(error); }
  }

  async requestFeedback(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.requestFeedback(req.body))); }
    catch (error) { next(error); }
  }

  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.submitFeedback(req.body))); }
    catch (error) { next(error); }
  }
}

export const performanceController = new PerformanceController();
