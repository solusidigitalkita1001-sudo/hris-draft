import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { employeeController } from './employee.controller';
import {
  createEmployeeSchema, updateEmployeeSchema, createCareerTransactionSchema,
  createEmployeeCompanyAssignmentSchema, updateEmployeeCompanyAssignmentSchema,
  createEmployeeFamilySchema, updateEmployeeFamilySchema,
  createEmployeeEducationSchema, updateEmployeeEducationSchema,
  createEmployeeEmergencyContactSchema, updateEmployeeEmergencyContactSchema,
  createEmployeeTrainingSchema, updateEmployeeTrainingSchema,
  createEmployeeSkillSchema, updateEmployeeSkillSchema,
  createEmployeeExperienceSchema, updateEmployeeExperienceSchema,
  createEmployeeAttachmentSchema, updateEmployeeAttachmentSchema,
} from './employee.dto';

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', authorize({ resource: 'employee', action: 'read' }), employeeController.findAll.bind(employeeController));
router.get('/export', authorize({ resource: 'employee', action: 'read' }), employeeController.exportCsv.bind(employeeController));
router.get('/:id', authorize({ resource: 'employee', action: 'read' }), employeeController.findById.bind(employeeController));
router.get('/:id/career-transactions', authorize({ resource: 'employee', action: 'read' }), employeeController.findCareerTransactions.bind(employeeController));
router.get('/:id/company-assignments', authorize({ resource: 'employee', action: 'read' }), employeeController.findCompanyAssignments.bind(employeeController));
router.post('/', authorize({ resource: 'employee', action: 'create' }), validate(createEmployeeSchema), employeeController.create.bind(employeeController));
router.post(
  '/:id/career-transactions',
  authorize({ resource: 'employee', action: 'update' }),
  validate(createCareerTransactionSchema),
  employeeController.createCareerTransaction.bind(employeeController)
);
router.post(
  '/:id/company-assignments',
  authorize({ resource: 'employee', action: 'update' }),
  validate(createEmployeeCompanyAssignmentSchema),
  employeeController.createCompanyAssignment.bind(employeeController)
);
router.post('/import', authorize({ resource: 'employee', action: 'create' }), upload.single('file'), employeeController.importCsv.bind(employeeController));
router.put('/:id', authorize({ resource: 'employee', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Employee', model: 'employee' }), validate(updateEmployeeSchema), employeeController.update.bind(employeeController));
router.put(
  '/:id/company-assignments/:assignmentId',
  authorize({ resource: 'employee', action: 'update' }),
  validate(updateEmployeeCompanyAssignmentSchema),
  employeeController.updateCompanyAssignment.bind(employeeController)
);
router.delete('/:id', authorize({ resource: 'employee', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Employee', model: 'employee' }), employeeController.delete.bind(employeeController));
router.delete(
  '/:id/company-assignments/:assignmentId',
  authorize({ resource: 'employee', action: 'update' }),
  employeeController.deleteCompanyAssignment.bind(employeeController)
);
router.patch('/:id/status', authorize({ resource: 'employee', action: 'update' }), employeeController.updateStatus.bind(employeeController));

// ============================================================
// Employee Detail Sub-Entities
// ============================================================

// Family
router.get('/:id/families', authorize({ resource: 'employee', action: 'read' }), employeeController.findFamilies.bind(employeeController));
router.post('/:id/families', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeFamilySchema), employeeController.createFamily.bind(employeeController));
router.put('/:id/families/:familyId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeFamilySchema), employeeController.updateFamily.bind(employeeController));
router.delete('/:id/families/:familyId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteFamily.bind(employeeController));

// Education
router.get('/:id/educations', authorize({ resource: 'employee', action: 'read' }), employeeController.findEducations.bind(employeeController));
router.post('/:id/educations', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeEducationSchema), employeeController.createEducation.bind(employeeController));
router.put('/:id/educations/:educationId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeEducationSchema), employeeController.updateEducation.bind(employeeController));
router.delete('/:id/educations/:educationId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteEducation.bind(employeeController));

// Emergency Contact
router.get('/:id/emergency-contacts', authorize({ resource: 'employee', action: 'read' }), employeeController.findEmergencyContacts.bind(employeeController));
router.post('/:id/emergency-contacts', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeEmergencyContactSchema), employeeController.createEmergencyContact.bind(employeeController));
router.put('/:id/emergency-contacts/:emergencyId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeEmergencyContactSchema), employeeController.updateEmergencyContact.bind(employeeController));
router.delete('/:id/emergency-contacts/:emergencyId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteEmergencyContact.bind(employeeController));

// Training
router.get('/:id/trainings', authorize({ resource: 'employee', action: 'read' }), employeeController.findTrainings.bind(employeeController));
router.post('/:id/trainings', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeTrainingSchema), employeeController.createTraining.bind(employeeController));
router.put('/:id/trainings/:trainingId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeTrainingSchema), employeeController.updateTraining.bind(employeeController));
router.delete('/:id/trainings/:trainingId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteTraining.bind(employeeController));

// Skill
router.get('/:id/skills', authorize({ resource: 'employee', action: 'read' }), employeeController.findSkills.bind(employeeController));
router.post('/:id/skills', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeSkillSchema), employeeController.createSkill.bind(employeeController));
router.put('/:id/skills/:skillId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeSkillSchema), employeeController.updateSkill.bind(employeeController));
router.delete('/:id/skills/:skillId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteSkill.bind(employeeController));

// Experience
router.get('/:id/experiences', authorize({ resource: 'employee', action: 'read' }), employeeController.findExperiences.bind(employeeController));
router.post('/:id/experiences', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeExperienceSchema), employeeController.createExperience.bind(employeeController));
router.put('/:id/experiences/:experienceId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeExperienceSchema), employeeController.updateExperience.bind(employeeController));
router.delete('/:id/experiences/:experienceId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteExperience.bind(employeeController));

// Attachment
router.get('/:id/attachments', authorize({ resource: 'employee', action: 'read' }), employeeController.findAttachments.bind(employeeController));
router.post('/:id/attachments', authorize({ resource: 'employee', action: 'update' }), validate(createEmployeeAttachmentSchema), employeeController.createAttachment.bind(employeeController));
router.put('/:id/attachments/:attachmentId', authorize({ resource: 'employee', action: 'update' }), validate(updateEmployeeAttachmentSchema), employeeController.updateAttachment.bind(employeeController));
router.delete('/:id/attachments/:attachmentId', authorize({ resource: 'employee', action: 'update' }), employeeController.deleteAttachment.bind(employeeController));

export default router;
