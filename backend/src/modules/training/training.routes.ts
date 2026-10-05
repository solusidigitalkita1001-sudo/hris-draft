import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { trainingController } from './training.controller';
import { createCategorySchema, createCourseSchema, updateCourseSchema, createSessionSchema, createEnrollmentSchema,
  courseEffectivenessQuerySchema,
  recordTrainingScoreSchema,
  submitTrainingFeedbackSchema,
} from './training.dto';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/categories', authorize({ resource: 'training', action: 'read' }), trainingController.findAllCategories.bind(trainingController));
router.post('/categories', authorize({ resource: 'training', action: 'create' }), validate(createCategorySchema), trainingController.createCategory.bind(trainingController));

// ==================== Evaluasi pasca-training ====================
// Static paths before /courses/:id so "enrollments" is never read as an id.
router.get(
  '/effectiveness',
  authorize({ resource: 'training', action: 'read' }),
  validate(courseEffectivenessQuerySchema, 'query'),
  trainingController.courseEffectiveness.bind(trainingController),
);
router.get(
  '/enrollments/:id/evaluation',
  authorize({ resource: 'training', action: 'read' }),
  trainingController.findEvaluation.bind(trainingController),
);
// The trainer's score: recorded by HR or the trainer, never by the participant.
router.patch(
  '/enrollments/:id/score',
  authorize({ resource: 'training', action: 'update' }),
  validate(recordTrainingScoreSchema),
  trainingController.recordScore.bind(trainingController),
);
// The participant's reaction: only they can file it, so no extra permission
// beyond a session — the service checks it is their own enrollment.
router.post(
  '/enrollments/:id/feedback',
  validate(submitTrainingFeedbackSchema),
  trainingController.submitFeedback.bind(trainingController),
);

router.get('/courses', authorize({ resource: 'training', action: 'read' }), trainingController.findAllCourses.bind(trainingController));
router.get('/courses/:id', authorize({ resource: 'training', action: 'read' }), trainingController.findCourseById.bind(trainingController));
router.post('/courses/:id/enroll', authorize({ resource: 'training', action: 'create' }), trainingController.enrollSelf.bind(trainingController));
router.post('/courses/:id/complete', authorize({ resource: 'training', action: 'update' }), trainingController.completeSelf.bind(trainingController));
router.post('/courses', authorize({ resource: 'training', action: 'create' }), validate(createCourseSchema), trainingController.createCourse.bind(trainingController));
router.patch('/courses/:id', authorize({ resource: 'training', action: 'update' }), validate(updateCourseSchema), trainingController.updateCourse.bind(trainingController));

router.get('/sessions', authorize({ resource: 'training', action: 'read' }), trainingController.findAllSessions.bind(trainingController));
router.post('/sessions', authorize({ resource: 'training', action: 'create' }), validate(createSessionSchema), trainingController.createSession.bind(trainingController));

router.get('/enrollments', authorize({ resource: 'training', action: 'read' }), trainingController.findAllEnrollments.bind(trainingController));
router.post('/enrollments', authorize({ resource: 'training', action: 'create' }), validate(createEnrollmentSchema), trainingController.createEnrollment.bind(trainingController));
router.patch('/enrollments/:id/complete', authorize({ resource: 'training', action: 'update' }), trainingController.completeEnrollment.bind(trainingController));

export default router;
