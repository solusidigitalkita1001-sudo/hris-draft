import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { performanceController } from './performance.controller';
import config from '@/config';
import { BadRequestError } from '@/shared/exceptions/AppError';
import {
  createReviewCycleSchema,
  createReviewSchema,
  createGoalSchema,
  updateGoalProgressSchema,
  createFeedbackRequestSchema,
  createFeedbackResponseSchema,
  createPerformanceMethodSchema,
  updatePerformanceMethodSchema,
  createPerformanceMethodVersionSchema,
  updatePerformanceMethodVersionSchema,
  createPerformanceComponentSchema,
  updatePerformanceComponentSchema,
  createPerformancePeriodSchema,
  updatePerformancePeriodSchema,
  createPerformancePlanningAssignmentSchema,
  updatePerformancePlanningAssignmentSchema,
  reassignPerformancePlanningAssignmentSchema,
  createPerformancePlanningTargetSchema,
  updatePerformancePlanningTargetSchema,
  createPerformanceTargetProgressSchema,
  performanceExecutionActionSchema,
  createPerformanceCalibrationSessionSchema,
  performanceCalibrationDecisionSchema,
  publishPerformanceResultsSchema,
  acknowledgePerformanceResultSchema,
  createPerformanceResultDisputeSchema,
  respondPerformanceResultDisputeSchema,
  approvePerformanceResultsSchema,
  reopenPerformanceResultSchema,
  sendPerformanceResultRemindersSchema,
  syncPerformanceDevelopmentRecommendationsSchema,
  assignPerformanceDevelopmentRecommendationSchema,
  createPerformanceAutomationScheduleSchema,
  createPerformanceFormulaSchema,
  updatePerformanceFormulaSchema,
  createPerformanceIndicatorSchema,
  updatePerformanceIndicatorSchema,
  createPerformanceGradeRuleSchema,
  updatePerformanceGradeRuleSchema,
  createPerformanceWorkflowTemplateSchema,
  updatePerformanceWorkflowTemplateSchema,
} from './performance.dto';

const router = Router();
const evidenceUploadDirectory = path.resolve(process.cwd(), `${config.upload.uploadPath}/performance/evidence`);
const attachmentUploadDirectory = path.resolve(process.cwd(), `${config.upload.uploadPath}/documents/performance-results`);
fs.mkdirSync(evidenceUploadDirectory, { recursive: true });
fs.mkdirSync(attachmentUploadDirectory, { recursive: true });

const evidenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, evidenceUploadDirectory);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const evidenceUpload = multer({
  storage: evidenceStorage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!config.upload.allowedMimes.includes(file.mimetype)) {
      cb(new BadRequestError('Unsupported evidence file type'));
      return;
    }

    cb(null, true);
  },
});

const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, attachmentUploadDirectory);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!config.upload.allowedMimes.includes(file.mimetype)) {
      cb(new BadRequestError('Unsupported attachment file type'));
      return;
    }

    cb(null, true);
  },
});

router.use(authenticate);

router.get('/methods', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllMethods.bind(performanceController));
router.get('/methods/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findMethodById.bind(performanceController));
router.post('/methods', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceMethodSchema), performanceController.createMethod.bind(performanceController));
router.put('/methods/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceMethodSchema), performanceController.updateMethod.bind(performanceController));
router.get('/methods/:id/versions', authorize({ resource: 'performance', action: 'read' }), performanceController.findMethodVersions.bind(performanceController));
router.post('/methods/:id/version', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceMethodVersionSchema), performanceController.createMethodVersion.bind(performanceController));

router.get('/method-versions/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findMethodVersionById.bind(performanceController));
router.get('/method-versions/:id/readiness', authorize({ resource: 'performance', action: 'read' }), performanceController.getMethodVersionReadiness.bind(performanceController));
router.put('/method-versions/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceMethodVersionSchema), performanceController.updateMethodVersion.bind(performanceController));
router.post('/method-versions/:id/publish', authorize({ resource: 'performance', action: 'update' }), performanceController.publishMethodVersion.bind(performanceController));

router.get('/review-workflows', authorize({ resource: 'performance', action: 'read' }), performanceController.findReviewWorkflowTemplates.bind(performanceController));
router.get('/review-workflows/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findReviewWorkflowTemplateById.bind(performanceController));
router.post('/review-workflows', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceWorkflowTemplateSchema), performanceController.createReviewWorkflowTemplate.bind(performanceController));
router.put('/review-workflows/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceWorkflowTemplateSchema), performanceController.updateReviewWorkflowTemplate.bind(performanceController));

router.get('/approval-workflows', authorize({ resource: 'performance', action: 'read' }), performanceController.findApprovalWorkflowTemplates.bind(performanceController));
router.get('/approval-workflows/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findApprovalWorkflowTemplateById.bind(performanceController));
router.post('/approval-workflows', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceWorkflowTemplateSchema), performanceController.createApprovalWorkflowTemplate.bind(performanceController));
router.put('/approval-workflows/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceWorkflowTemplateSchema), performanceController.updateApprovalWorkflowTemplate.bind(performanceController));

router.get('/formulas', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllFormulas.bind(performanceController));
router.get('/formulas/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findFormulaById.bind(performanceController));
router.post('/formulas', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceFormulaSchema), performanceController.createFormula.bind(performanceController));
router.put('/formulas/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceFormulaSchema), performanceController.updateFormula.bind(performanceController));

router.get('/indicators', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllIndicators.bind(performanceController));
router.get('/indicators/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findIndicatorById.bind(performanceController));
router.post('/indicators', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceIndicatorSchema), performanceController.createIndicator.bind(performanceController));
router.put('/indicators/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceIndicatorSchema), performanceController.updateIndicator.bind(performanceController));

router.get('/grades', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllGradeRules.bind(performanceController));
router.get('/grades/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findGradeRuleById.bind(performanceController));
router.post('/grades', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceGradeRuleSchema), performanceController.createGradeRule.bind(performanceController));
router.put('/grades/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceGradeRuleSchema), performanceController.updateGradeRule.bind(performanceController));

router.get('/method-versions/:id/components', authorize({ resource: 'performance', action: 'read' }), performanceController.findComponentsByMethodVersion.bind(performanceController));
router.post('/method-versions/:id/components', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceComponentSchema), performanceController.createComponent.bind(performanceController));
router.put('/components/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformanceComponentSchema), performanceController.updateComponent.bind(performanceController));

router.get('/periods', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllPeriods.bind(performanceController));
router.get('/periods/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findPeriodById.bind(performanceController));
router.post('/periods', authorize({ resource: 'performance', action: 'create' }), validate(createPerformancePeriodSchema), performanceController.createPeriod.bind(performanceController));
router.put('/periods/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformancePeriodSchema), performanceController.updatePeriod.bind(performanceController));
router.get('/periods/:id/readiness', authorize({ resource: 'performance', action: 'read' }), performanceController.getPeriodReadiness.bind(performanceController));
router.post('/periods/:id/publish', authorize({ resource: 'performance', action: 'update' }), performanceController.publishPeriod.bind(performanceController));
router.get('/periods/:id/planning', authorize({ resource: 'performance', action: 'read' }), performanceController.getPlanningWorkspace.bind(performanceController));
router.post('/periods/:id/planning/assignments', authorize({ resource: 'performance', action: 'create' }), validate(createPerformancePlanningAssignmentSchema), performanceController.createPlanningAssignment.bind(performanceController));
router.post('/periods/:id/planning/publish', authorize({ resource: 'performance', action: 'update' }), performanceController.publishPlanning.bind(performanceController));
router.put('/planning-assignments/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformancePlanningAssignmentSchema), performanceController.updatePlanningAssignment.bind(performanceController));
router.post('/planning-assignments/:id/reassign', authorize({ resource: 'performance', action: 'update' }), validate(reassignPerformancePlanningAssignmentSchema), performanceController.reassignPlanningAssignment.bind(performanceController));
router.delete('/planning-assignments/:id', authorize({ resource: 'performance', action: 'update' }), performanceController.deletePlanningAssignment.bind(performanceController));
router.post('/planning-assignments/:id/submit', authorize({ resource: 'performance', action: 'update' }), validate(performanceExecutionActionSchema), performanceController.submitPlanningAssignment.bind(performanceController));
router.post('/planning-assignments/:id/approve', authorize({ resource: 'performance', action: 'approve' }), validate(performanceExecutionActionSchema), performanceController.approvePlanningAssignment.bind(performanceController));
router.post('/planning-assignments/:id/reject', authorize({ resource: 'performance', action: 'approve' }), validate(performanceExecutionActionSchema), performanceController.rejectPlanningAssignment.bind(performanceController));
router.post('/planning-assignments/:id/revision', authorize({ resource: 'performance', action: 'approve' }), validate(performanceExecutionActionSchema), performanceController.requestPlanningAssignmentRevision.bind(performanceController));
router.post('/planning-assignments/:id/complete', authorize({ resource: 'performance', action: 'update' }), validate(performanceExecutionActionSchema), performanceController.completePlanningAssignment.bind(performanceController));
router.post('/planning-assignments/:id/targets', authorize({ resource: 'performance', action: 'create' }), validate(createPerformancePlanningTargetSchema), performanceController.createPlanningTarget.bind(performanceController));
router.put('/planning-targets/:id', authorize({ resource: 'performance', action: 'update' }), validate(updatePerformancePlanningTargetSchema), performanceController.updatePlanningTarget.bind(performanceController));
router.delete('/planning-targets/:id', authorize({ resource: 'performance', action: 'update' }), performanceController.deletePlanningTarget.bind(performanceController));
router.post('/planning-targets/:id/progress', authorize({ resource: 'performance', action: 'update' }), validate(createPerformanceTargetProgressSchema), performanceController.createPlanningTargetProgress.bind(performanceController));
router.post('/planning-targets/:id/evidences', authorize({ resource: 'performance', action: 'update' }), evidenceUpload.single('file'), performanceController.uploadPlanningEvidence.bind(performanceController));
router.get('/execution/approval-queue', authorize({ resource: 'performance', action: 'read' }), performanceController.getExecutionApprovalQueue.bind(performanceController));
router.get('/periods/:id/results', authorize({ resource: 'performance', action: 'read' }), performanceController.getPerformanceResults.bind(performanceController));
router.get('/periods/:id/development-recommendations', authorize({ resource: 'performance', action: 'read' }), performanceController.getDevelopmentRecommendations.bind(performanceController));
router.post('/periods/:id/development-recommendations/sync', authorize({ resource: 'performance', action: 'update' }), validate(syncPerformanceDevelopmentRecommendationsSchema), performanceController.syncDevelopmentRecommendations.bind(performanceController));
router.post('/development-recommendations/:id/assign', authorize({ resource: 'performance', action: 'update' }), validate(assignPerformanceDevelopmentRecommendationSchema), performanceController.assignDevelopmentRecommendation.bind(performanceController));
router.post('/periods/:id/results/calculate', authorize({ resource: 'performance', action: 'update' }), performanceController.calculatePerformanceResults.bind(performanceController));
router.get('/periods/:id/results/dashboard', authorize({ resource: 'performance', action: 'read' }), performanceController.getPerformanceResultDashboard.bind(performanceController));
router.post('/periods/:id/results/final-approve', authorize({ resource: 'performance', action: 'approve' }), validate(approvePerformanceResultsSchema), performanceController.approvePerformanceResults.bind(performanceController));
router.post('/periods/:id/results/publish', authorize({ resource: 'performance', action: 'approve' }), validate(publishPerformanceResultsSchema), performanceController.publishPerformanceResults.bind(performanceController));
router.post('/periods/:id/results/reminders', authorize({ resource: 'performance', action: 'approve' }), validate(sendPerformanceResultRemindersSchema), performanceController.sendPerformanceResultReminders.bind(performanceController));
router.get('/periods/:id/automation-schedules', authorize({ resource: 'performance', action: 'read' }), performanceController.getAutomationSchedules.bind(performanceController));
router.post('/periods/:id/automation-schedules', authorize({ resource: 'performance', action: 'update' }), validate(createPerformanceAutomationScheduleSchema), performanceController.createAutomationSchedule.bind(performanceController));
router.get('/results/me', authorize({ resource: 'performance', action: 'read' }), performanceController.getMyPublishedResults.bind(performanceController));
router.post('/results/:id/acknowledge', authorize({ resource: 'performance', action: 'read' }), validate(acknowledgePerformanceResultSchema), performanceController.acknowledgePerformanceResult.bind(performanceController));
router.post('/results/:id/attachments', authorize({ resource: 'performance', action: 'read' }), attachmentUpload.single('file'), performanceController.uploadPerformanceResultAttachment.bind(performanceController));
router.post('/results/:id/disputes', authorize({ resource: 'performance', action: 'read' }), validate(createPerformanceResultDisputeSchema), performanceController.createPerformanceResultDispute.bind(performanceController));
router.post('/results/:id/reopen', authorize({ resource: 'performance', action: 'approve' }), validate(reopenPerformanceResultSchema), performanceController.reopenPerformanceResult.bind(performanceController));
router.post('/result-disputes/:id/attachments', authorize({ resource: 'performance', action: 'read' }), attachmentUpload.single('file'), performanceController.uploadPerformanceDisputeAttachment.bind(performanceController));
router.post('/result-disputes/:id/respond', authorize({ resource: 'performance', action: 'approve' }), validate(respondPerformanceResultDisputeSchema), performanceController.respondPerformanceResultDispute.bind(performanceController));
router.get('/periods/:id/calibrations', authorize({ resource: 'performance', action: 'read' }), performanceController.getCalibrationSessions.bind(performanceController));
router.post('/periods/:id/calibrations', authorize({ resource: 'performance', action: 'create' }), validate(createPerformanceCalibrationSessionSchema), performanceController.createCalibrationSession.bind(performanceController));
router.post('/calibration-sessions/:id/open', authorize({ resource: 'performance', action: 'approve' }), performanceController.openCalibrationSession.bind(performanceController));
router.post('/calibration-sessions/:id/close', authorize({ resource: 'performance', action: 'approve' }), performanceController.closeCalibrationSession.bind(performanceController));
router.post('/calibration-sessions/:id/finalize', authorize({ resource: 'performance', action: 'approve' }), performanceController.finalizeCalibrationSession.bind(performanceController));
router.post('/calibration-participants/:id/decision', authorize({ resource: 'performance', action: 'approve' }), validate(performanceCalibrationDecisionSchema), performanceController.applyCalibrationDecision.bind(performanceController));

router.get('/review-cycles', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllCycles.bind(performanceController));
router.post('/review-cycles', authorize({ resource: 'performance', action: 'create' }), validate(createReviewCycleSchema), performanceController.createCycle.bind(performanceController));

router.get('/reviews', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllReviews.bind(performanceController));
router.get('/reviews/:id', authorize({ resource: 'performance', action: 'read' }), performanceController.findReviewById.bind(performanceController));
router.post('/reviews', authorize({ resource: 'performance', action: 'create' }), validate(createReviewSchema), performanceController.createReview.bind(performanceController));
router.patch('/reviews/:id/submit', authorize({ resource: 'performance', action: 'update' }), performanceController.submitReview.bind(performanceController));
router.patch('/reviews/:id/approve', authorize({ resource: 'performance', action: 'approve' }), performanceController.approveReview.bind(performanceController));

router.get('/goals', authorize({ resource: 'performance', action: 'read' }), performanceController.findAllGoals.bind(performanceController));
router.post('/goals', authorize({ resource: 'performance', action: 'create' }), validate(createGoalSchema), performanceController.createGoal.bind(performanceController));
router.patch('/goals/:id/progress', authorize({ resource: 'performance', action: 'update' }), validate(updateGoalProgressSchema), performanceController.updateGoalProgress.bind(performanceController));

router.get('/feedback-requests', authorize({ resource: 'performance', action: 'read' }), performanceController.getFeedbackRequests.bind(performanceController));
router.post('/feedback-requests', authorize({ resource: 'performance', action: 'create' }), validate(createFeedbackRequestSchema), performanceController.requestFeedback.bind(performanceController));
router.post('/feedback-responses', authorize({ resource: 'performance', action: 'create' }), validate(createFeedbackResponseSchema), performanceController.submitFeedback.bind(performanceController));

export default router;
