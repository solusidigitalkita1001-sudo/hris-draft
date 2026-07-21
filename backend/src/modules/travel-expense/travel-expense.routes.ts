import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorizeRole } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { travelExpenseController } from './travel-expense.controller';
import config from '@/config';
import { BadRequestError } from '@/shared/exceptions/AppError';
import {
  approveBusinessTripSchema,
  approveExpenseClaimSchema,
  createBusinessTripSchema,
  createExpenseClaimSchema,
  createTravelAdvanceSchema,
  reimburseExpenseClaimSchema,
} from './travel-expense.dto';

const router = Router();

const uploadDirectory = path.resolve(process.cwd(), 'uploads/travel-expenses/receipts');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!config.upload.allowedMimes.includes(file.mimetype)) {
      cb(new BadRequestError('Unsupported receipt file type'));
      return;
    }
    cb(null, true);
  },
});

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
  '/claims/receipt-upload',
  authorizeRole(...employeeRoles),
  upload.single('receipt'),
  travelExpenseController.uploadReceipt.bind(travelExpenseController)
);
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
