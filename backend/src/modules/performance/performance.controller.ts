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
      employeeId: req.user.employeeId,
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

  async getMethodVersionReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getMethodVersionReadiness(req.params.id as string)));
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

  async getPlanningWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getPlanningWorkspace(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createPlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createPlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async updatePlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updatePlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async reassignPlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.reassignPlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async deletePlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await performanceService.deletePlanningAssignment(req.params.id as string, this.getAuditContext(req));
      res.json(Result.success({ id: req.params.id }, 'Deleted successfully'));
    } catch (error) { next(error); }
  }

  async createPlanningTarget(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createPlanningTarget(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async updatePlanningTarget(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updatePlanningTarget(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async deletePlanningTarget(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await performanceService.deletePlanningTarget(req.params.id as string, this.getAuditContext(req));
      res.json(Result.success({ id: req.params.id }, 'Deleted successfully'));
    } catch (error) { next(error); }
  }

  async publishPlanning(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.publishPlanning(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async createPlanningTargetProgress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createPlanningTargetProgress(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async uploadPlanningEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.uploadPlanningEvidence(
        req.params.id as string,
        req.file as any,
        req.body.notes as string | undefined,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async submitPlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.submitPlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async approvePlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.approvePlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async rejectPlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.rejectPlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async requestPlanningAssignmentRevision(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.requestPlanningAssignmentRevision(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async completePlanningAssignment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.completePlanningAssignment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getExecutionApprovalQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.getExecutionApprovalQueue(
        companyId,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getMyExecutionAssignments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.getMyExecutionAssignments(
        companyId,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getExecutionAssignmentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getExecutionAssignmentById(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async updateExecutionTargetComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.updateExecutionTargetComment(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getPerformanceResults(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getPerformanceResults(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async getDevelopmentRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getDevelopmentRecommendations(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async syncDevelopmentRecommendations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.syncPerformanceDevelopmentRecommendations(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async assignDevelopmentRecommendation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.assignPerformanceDevelopmentRecommendation(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async calculatePerformanceResults(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.calculatePerformanceResults(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getPerformanceResultDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getPerformanceResultDashboard(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async publishPerformanceResults(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.publishPerformanceResults(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async approvePerformanceResults(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.approvePerformanceResults(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getMyPublishedResults(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      res.json(Result.success(await performanceService.getMyPublishedResults(
        companyId,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async acknowledgePerformanceResult(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.acknowledgePerformanceResult(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async uploadPerformanceResultAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.uploadPerformanceResultAttachment(
        req.params.id as string,
        req.file as any,
        {
          title: req.body.title as string | undefined,
          description: req.body.description as string | undefined,
          visibility: req.body.visibility as 'INTERNAL' | 'RESTRICTED' | 'PUBLIC' | undefined,
        },
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async createPerformanceResultDispute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createPerformanceResultDispute(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async uploadPerformanceDisputeAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.uploadPerformanceDisputeAttachment(
        req.params.id as string,
        req.file as any,
        {
          title: req.body.title as string | undefined,
          description: req.body.description as string | undefined,
          visibility: req.body.visibility as 'INTERNAL' | 'RESTRICTED' | 'PUBLIC' | undefined,
        },
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async respondPerformanceResultDispute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.respondPerformanceResultDispute(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async reopenPerformanceResult(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.reopenPerformanceResult(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async sendPerformanceResultReminders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.sendPerformanceResultReminders(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getAutomationSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getAutomationSchedules(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createAutomationSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createAutomationSchedule(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async getCalibrationSessions(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await performanceService.getCalibrationSessions(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async createCalibrationSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(Result.created(await performanceService.createCalibrationSession(
        req.params.id as string,
        req.body,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async openCalibrationSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.openCalibrationSession(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async closeCalibrationSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.closeCalibrationSession(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async finalizeCalibrationSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.finalizeCalibrationSession(
        req.params.id as string,
        this.getAuditContext(req)
      )));
    } catch (error) { next(error); }
  }

  async applyCalibrationDecision(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(await performanceService.applyCalibrationDecision(
        req.params.id as string,
        req.body,
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
