import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { onboardingController } from './onboarding.controller';
import { createChecklistSchema, updateChecklistSchema, createResignationSchema, finalPayrollSchema } from './onboarding.dto';

const router = Router();
router.use(authenticate);

router.get('/checklists', authorize({ resource: 'employee', action: 'read' }), onboardingController.getChecklists.bind(onboardingController));
router.post('/checklists', authorize({ resource: 'employee', action: 'create' }), validate(createChecklistSchema), onboardingController.createChecklist.bind(onboardingController));
router.patch('/checklists/:id', authorize({ resource: 'employee', action: 'update' }), validate(updateChecklistSchema), onboardingController.updateChecklist.bind(onboardingController));

router.get('/resignations', authorize({ resource: 'employee', action: 'read' }), onboardingController.findAllResignations.bind(onboardingController));
router.get('/resignations/:id', authorize({ resource: 'employee', action: 'read' }), onboardingController.findResignationById.bind(onboardingController));
router.post('/resignations', authorize({ resource: 'employee', action: 'create' }), validate(createResignationSchema), onboardingController.createResignation.bind(onboardingController));
router.patch('/resignations/:id/approve', authorize({ resource: 'employee', action: 'update' }), onboardingController.approveResignation.bind(onboardingController));
router.patch('/resignations/:id/reject', authorize({ resource: 'employee', action: 'update' }), onboardingController.rejectResignation.bind(onboardingController));

router.post('/resignations/:id/final-payroll', authorize({ resource: 'payroll', action: 'read' }), validate(finalPayrollSchema), onboardingController.calculateFinalPayroll.bind(onboardingController));

router.patch('/clearances/:id', authorize({ resource: 'employee', action: 'update' }), onboardingController.updateClearance.bind(onboardingController));

export default router;
