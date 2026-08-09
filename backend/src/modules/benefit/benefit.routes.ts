import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { benefitController } from './benefit.controller';
import {
  createBenefitPlanSchema,
  updateBenefitPlanSchema,
  createBenefitEnrollmentSchema,
  updateBenefitEnrollmentSchema,
} from './benefit.dto';
import { idParamSchema } from './benefit.validation';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireCompanyAccess());

// ==================== Benefit Plans ====================
router.get(
  '/plans',
  authorize({ resource: 'benefit', action: 'read' }),
  benefitController.findAllPlans.bind(benefitController)
);

router.get(
  '/plans/:id',
  authorize({ resource: 'benefit', action: 'read' }),
  validate(idParamSchema, 'params'),
  benefitController.findPlanById.bind(benefitController)
);

router.post(
  '/plans',
  authorize({ resource: 'benefit', action: 'create' }),
  validate(createBenefitPlanSchema, 'body'),
  benefitController.createPlan.bind(benefitController)
);

router.patch(
  '/plans/:id',
  authorize({ resource: 'benefit', action: 'update' }),
  validate(idParamSchema, 'params'),
  validate(updateBenefitPlanSchema, 'body'),
  benefitController.updatePlan.bind(benefitController)
);

router.delete(
  '/plans/:id',
  authorize({ resource: 'benefit', action: 'delete' }),
  validate(idParamSchema, 'params'),
  benefitController.deletePlan.bind(benefitController)
);

// ==================== Benefit Enrollments ====================
router.get(
  '/enrollments',
  authorize({ resource: 'benefit', action: 'read' }),
  benefitController.findAllEnrollments.bind(benefitController)
);

router.get(
  '/enrollments/:id',
  authorize({ resource: 'benefit', action: 'read' }),
  validate(idParamSchema, 'params'),
  benefitController.findEnrollmentById.bind(benefitController)
);

router.post(
  '/enrollments',
  authorize({ resource: 'benefit', action: 'create' }),
  validate(createBenefitEnrollmentSchema, 'body'),
  benefitController.createEnrollment.bind(benefitController)
);

router.patch(
  '/enrollments/:id',
  authorize({ resource: 'benefit', action: 'update' }),
  validate(idParamSchema, 'params'),
  validate(updateBenefitEnrollmentSchema, 'body'),
  benefitController.updateEnrollment.bind(benefitController)
);

router.delete(
  '/enrollments/:id',
  authorize({ resource: 'benefit', action: 'delete' }),
  validate(idParamSchema, 'params'),
  benefitController.deleteEnrollment.bind(benefitController)
);

export default router;
