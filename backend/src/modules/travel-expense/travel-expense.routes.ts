import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorizeRole } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { travelExpenseController } from './travel-expense.controller';
import {
  approveBusinessTripSchema,
  approveExpenseClaimSchema,
  createBusinessTripSchema,
  createExpenseClaimSchema,
  createTravelAdvanceSchema,
  reimburseExpenseClaimSchema,
} from './travel-expense.dto';

const router = Router();

router.use(authenticate);

const employeeRoles = ['GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER', 'EMPLOYEE'];
const approverRoles = ['GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'];

router.get('/categories', travelExpenseController.getExpenseCategories.bind(travelExpenseController));

router.get('/trips', authorizeRole(...approverRoles), travelExpenseController.findTrips.bind(travelExpenseController));
router.get('/trips/my', authorizeRole(...employeeRoles), travelExpenseController.findMyTrips.bind(travelExpenseController));
router.post(
  '/trips',
  authorizeRole(...employeeRoles),
  validate(createBusinessTripSchema),
  travelExpenseController.createTrip.bind(travelExpenseController)
);
router.patch(
  '/trips/:id/approve',
  authorizeRole(...approverRoles),
  validate(approveBusinessTripSchema),
  travelExpenseController.approveTrip.bind(travelExpenseController)
);
router.patch(
  '/trips/:id/reject',
  authorizeRole(...approverRoles),
  validate(approveBusinessTripSchema),
  travelExpenseController.rejectTrip.bind(travelExpenseController)
);
router.post(
  '/trips/:id/advance',
  authorizeRole(...approverRoles),
  validate(createTravelAdvanceSchema),
  travelExpenseController.createAdvance.bind(travelExpenseController)
);

router.get('/claims', authorizeRole(...approverRoles), travelExpenseController.findClaims.bind(travelExpenseController));
router.get('/claims/my', authorizeRole(...employeeRoles), travelExpenseController.findMyClaims.bind(travelExpenseController));
router.post(
  '/claims',
  authorizeRole(...employeeRoles),
  validate(createExpenseClaimSchema),
  travelExpenseController.createClaim.bind(travelExpenseController)
);
router.patch(
  '/claims/:id/approve',
  authorizeRole(...approverRoles),
  validate(approveExpenseClaimSchema),
  travelExpenseController.approveClaim.bind(travelExpenseController)
);
router.patch(
  '/claims/:id/reject',
  authorizeRole(...approverRoles),
  validate(approveExpenseClaimSchema),
  travelExpenseController.rejectClaim.bind(travelExpenseController)
);
router.post(
  '/claims/:id/reimburse',
  authorizeRole(...approverRoles),
  validate(reimburseExpenseClaimSchema),
  travelExpenseController.reimburseClaim.bind(travelExpenseController)
);

export default router;
