import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { employeeLoanController } from './employee-loan.controller';
import { createLoanSchema, approveLoanSchema } from './employee-loan.dto';
import { workflowActionSchema } from '@/modules/workflow-engine/workflow-engine.dto';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/types', employeeLoanController.findLoanTypes.bind(employeeLoanController));

router.get('/', authorize({ resource: 'employee-loan', action: 'read' }), employeeLoanController.findAll.bind(employeeLoanController));
router.get('/my', employeeLoanController.findMyLoans.bind(employeeLoanController));
router.get('/:id', authorize({ resource: 'employee-loan', action: 'read' }), employeeLoanController.findById.bind(employeeLoanController));
router.post('/', validate(createLoanSchema), employeeLoanController.create.bind(employeeLoanController));

router.patch('/:id/approve', authorize({ resource: 'employee-loan', action: 'update' }), validate(approveLoanSchema), employeeLoanController.approve.bind(employeeLoanController));
router.patch('/:id/reject', authorize({ resource: 'employee-loan', action: 'update' }), validate(approveLoanSchema), employeeLoanController.reject.bind(employeeLoanController));

router.get('/:id/workflow', authorize({ resource: 'employee-loan', action: 'read' }), employeeLoanController.getWorkflow.bind(employeeLoanController));
router.patch('/:id/workflow-action', authorize({ resource: 'employee-loan', action: 'update' }), validate(workflowActionSchema), employeeLoanController.applyWorkflowAction.bind(employeeLoanController));

router.get('/:id/installments', authorize({ resource: 'employee-loan', action: 'read' }), employeeLoanController.getInstallments.bind(employeeLoanController));
router.get('/:id/amortization', authorize({ resource: 'employee-loan', action: 'read' }), employeeLoanController.getAmortization.bind(employeeLoanController));

export default router;
