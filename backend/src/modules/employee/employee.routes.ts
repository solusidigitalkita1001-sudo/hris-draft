import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { employeeController } from './employee.controller';
import { createEmployeeSchema, updateEmployeeSchema, createCareerTransactionSchema } from './employee.dto';

const router = Router();
router.use(authenticate);

router.get('/', authorize({ resource: 'employee', action: 'read' }), employeeController.findAll.bind(employeeController));
router.get('/:id', authorize({ resource: 'employee', action: 'read' }), employeeController.findById.bind(employeeController));
router.get('/:id/career-transactions', authorize({ resource: 'employee', action: 'read' }), employeeController.findCareerTransactions.bind(employeeController));
router.post('/', authorize({ resource: 'employee', action: 'create' }), validate(createEmployeeSchema), employeeController.create.bind(employeeController));
router.post(
  '/:id/career-transactions',
  authorize({ resource: 'employee', action: 'update' }),
  validate(createCareerTransactionSchema),
  employeeController.createCareerTransaction.bind(employeeController)
);
router.put('/:id', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeSchema), employeeController.update.bind(employeeController));
router.delete('/:id', authorize({ resource: 'employee', action: 'delete' }), employeeController.delete.bind(employeeController));
router.patch('/:id/status', authorize({ resource: 'employee', action: 'update' }), employeeController.updateStatus.bind(employeeController));

export default router;
