import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { customFieldController } from './custom-field.controller';
import { createCustomFieldSchema, employeeIdParamSchema, setCustomFieldValuesSchema, updateCustomFieldSchema } from './custom-field.dto';
import { idParamSchema } from '@/modules/payroll/payroll.validation';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Definisi adalah konfigurasi perusahaan → izin settings; nilai adalah data
// karyawan → izin employee. Tidak ada resource izin baru.
router.get('/', authorize({ resource: 'settings', action: 'read' }), customFieldController.list.bind(customFieldController));
router.post('/',
  authorize({ resource: 'settings', action: 'update' }),
  auditLog({ action: 'CREATE', entity: 'CustomFieldDefinition' }),
  validate(createCustomFieldSchema),
  customFieldController.create.bind(customFieldController));
router.patch('/:id',
  authorize({ resource: 'settings', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'CustomFieldDefinition', model: 'customFieldDefinition' }),
  validate(idParamSchema, 'params'),
  validate(updateCustomFieldSchema),
  customFieldController.update.bind(customFieldController));

router.get('/employees/:employeeId/values',
  authorize({ resource: 'employee', action: 'read' }),
  validate(employeeIdParamSchema, 'params'),
  customFieldController.valuesFor.bind(customFieldController));
router.put('/employees/:employeeId/values',
  authorize({ resource: 'employee', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'EmployeeCustomFieldValue' }),
  validate(employeeIdParamSchema, 'params'),
  validate(setCustomFieldValuesSchema),
  customFieldController.setValues.bind(customFieldController));

export default router;
