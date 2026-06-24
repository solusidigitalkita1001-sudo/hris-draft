import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { performanceController } from './performance.controller';
import { createReviewCycleSchema, createReviewSchema, createGoalSchema, updateGoalProgressSchema, createFeedbackRequestSchema, createFeedbackResponseSchema } from './performance.dto';

const router = Router();
router.use(authenticate);

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
