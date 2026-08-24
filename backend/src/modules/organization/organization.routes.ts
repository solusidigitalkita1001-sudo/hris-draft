import { Router } from 'express';
import { groupController } from './controllers/group.controller';
import { companyController } from './controllers/company.controller';
import { branchController } from './controllers/branch.controller';
import { divisionController } from './controllers/division.controller';
import { departmentController } from './controllers/department.controller';
import { positionController } from './controllers/position.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { parsePagination } from '@/shared/middleware/Pagination';
import {
  createGroupSchema,
  updateGroupSchema,
  createCompanySchema,
  updateCompanySchema,
  createBranchSchema,
  updateBranchSchema,
  upsertBranchAttendancePolicySchema,
  createDivisionSchema,
  updateDivisionSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createPositionSchema,
  updatePositionSchema,
} from './organization.dto';

const router = Router();

// All organization routes require authentication
router.use(authenticate);
router.use(requireCompanyAccess());

// ==================== Company Groups ====================
router.get('/groups', authorize({ resource: 'organization', action: 'read' }), groupController.findAll.bind(groupController));
router.get('/groups/:id', authorize({ resource: 'organization', action: 'read' }), groupController.findById.bind(groupController));
router.post('/groups', authorize({ resource: 'organization', action: 'create' }), auditLog({ action: 'CREATE', entity: 'CompanyGroup' }), validate(createGroupSchema), groupController.create.bind(groupController));
router.put('/groups/:id', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'CompanyGroup', model: 'companyGroup' }), validate(updateGroupSchema), groupController.update.bind(groupController));
router.delete('/groups/:id', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'CompanyGroup', model: 'companyGroup' }), groupController.delete.bind(groupController));

// ==================== Companies ====================
router.get('/companies', authorize({ resource: 'organization', action: 'read' }), companyController.findAll.bind(companyController));
router.get('/companies/:id', authorize({ resource: 'organization', action: 'read' }), companyController.findById.bind(companyController));
router.post('/companies', authorize({ resource: 'organization', action: 'create' }), auditLog({ action: 'CREATE', entity: 'Company' }), validate(createCompanySchema), companyController.create.bind(companyController));
router.put('/companies/:id', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Company', model: 'company' }), validate(updateCompanySchema), companyController.update.bind(companyController));
router.delete('/companies/:id', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Company', model: 'company' }), companyController.delete.bind(companyController));
router.get('/companies/:id/attendance-policy', authorize({ resource: 'organization', action: 'read' }), companyController.getDefaultAttendancePolicy.bind(companyController));
router.put('/companies/:id/attendance-policy', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPSERT_ATTENDANCE_POLICY', entity: 'Company' }), validate(upsertBranchAttendancePolicySchema), companyController.upsertDefaultAttendancePolicy.bind(companyController));
router.delete('/companies/:id/attendance-policy', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE_ATTENDANCE_POLICY', entity: 'Company' }), companyController.deleteDefaultAttendancePolicy.bind(companyController));

// ==================== Branches ====================
router.get('/branches', authorize({ resource: 'organization', action: 'read' }), branchController.findAll.bind(branchController));
router.get('/branches/:id', authorize({ resource: 'organization', action: 'read' }), branchController.findById.bind(branchController));
router.post('/branches', authorize({ resource: 'organization', action: 'create' }), auditLog({ action: 'CREATE', entity: 'Branch' }), validate(createBranchSchema), branchController.create.bind(branchController));
router.put('/branches/:id', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Branch', model: 'branch' }), validate(updateBranchSchema), branchController.update.bind(branchController));
router.delete('/branches/:id', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Branch', model: 'branch' }), branchController.delete.bind(branchController));
router.get('/branches/:id/attendance-policy', authorize({ resource: 'organization', action: 'read' }), branchController.getAttendancePolicy.bind(branchController));
router.put('/branches/:id/attendance-policy', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPSERT_ATTENDANCE_POLICY', entity: 'Branch' }), validate(upsertBranchAttendancePolicySchema), branchController.upsertAttendancePolicy.bind(branchController));
router.delete('/branches/:id/attendance-policy', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE_ATTENDANCE_POLICY', entity: 'Branch' }), branchController.deleteAttendancePolicy.bind(branchController));

// ==================== Divisions ====================
router.get('/divisions', authorize({ resource: 'organization', action: 'read' }), divisionController.findAll.bind(divisionController));
router.get('/divisions/:id', authorize({ resource: 'organization', action: 'read' }), divisionController.findById.bind(divisionController));
router.post('/divisions', authorize({ resource: 'organization', action: 'create' }), auditLog({ action: 'CREATE', entity: 'Division' }), validate(createDivisionSchema), divisionController.create.bind(divisionController));
router.put('/divisions/:id', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Division', model: 'division' }), validate(updateDivisionSchema), divisionController.update.bind(divisionController));
router.delete('/divisions/:id', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Division', model: 'division' }), divisionController.delete.bind(divisionController));

// ==================== Departments ====================
router.get('/departments', authorize({ resource: 'organization', action: 'read' }), departmentController.findAll.bind(departmentController));
router.get('/departments/:id', authorize({ resource: 'organization', action: 'read' }), departmentController.findById.bind(departmentController));
router.post('/departments', authorize({ resource: 'organization', action: 'create' }), auditLog({ action: 'CREATE', entity: 'Department' }), validate(createDepartmentSchema), departmentController.create.bind(departmentController));
router.put('/departments/:id', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Department', model: 'department' }), validate(updateDepartmentSchema), departmentController.update.bind(departmentController));
router.delete('/departments/:id', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Department', model: 'department' }), departmentController.delete.bind(departmentController));
router.get('/departments/hierarchy/:companyId', authorize({ resource: 'organization', action: 'read' }), departmentController.getHierarchy.bind(departmentController));

// ==================== Positions ====================
router.get('/positions', authorize({ resource: 'organization', action: 'read' }), positionController.findAll.bind(positionController));
router.get('/positions/:id', authorize({ resource: 'organization', action: 'read' }), positionController.findById.bind(positionController));
router.post('/positions', authorize({ resource: 'organization', action: 'create' }), auditLog({ action: 'CREATE', entity: 'Position' }), validate(createPositionSchema), positionController.create.bind(positionController));
router.put('/positions/:id', authorize({ resource: 'organization', action: 'update' }), auditLog({ action: 'UPDATE', entity: 'Position', model: 'position' }), validate(updatePositionSchema), positionController.update.bind(positionController));
router.delete('/positions/:id', authorize({ resource: 'organization', action: 'delete' }), auditLog({ action: 'DELETE', entity: 'Position', model: 'position' }), positionController.delete.bind(positionController));

export default router;
