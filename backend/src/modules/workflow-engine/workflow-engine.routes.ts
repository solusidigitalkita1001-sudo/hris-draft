import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { validate } from '@/shared/middleware/RequestValidator';
import { workflowEngineController } from './workflow-engine.controller';
import {
  bulkApprovalSchema,
  createDelegationSchema,
  createWorkflowTemplateSchema,
  startWorkflowInstanceSchema,
  updateWorkflowTemplateSchema,
  workflowActionSchema,
} from './workflow-engine.dto';

const router = Router();

router.use(authenticate);
// Validates any client-supplied companyId against the caller's scope before
// templates/instances queries trust it.
router.use(requireCompanyAccess());

router.get('/templates', authorize({ resource: 'workflow', action: 'read' }), workflowEngineController.findTemplates.bind(workflowEngineController));
router.get('/templates/:id', authorize({ resource: 'workflow', action: 'read' }), workflowEngineController.findTemplateById.bind(workflowEngineController));
router.post('/templates', authorize({ resource: 'workflow', action: 'create' }), validate(createWorkflowTemplateSchema), workflowEngineController.createTemplate.bind(workflowEngineController));
router.put('/templates/:id', authorize({ resource: 'workflow', action: 'update' }), validate(updateWorkflowTemplateSchema), workflowEngineController.updateTemplate.bind(workflowEngineController));
router.delete('/templates/:id', authorize({ resource: 'workflow', action: 'delete' }), workflowEngineController.deleteTemplate.bind(workflowEngineController));

router.get('/instances', authorize({ resource: 'workflow', action: 'read' }), workflowEngineController.findInstances.bind(workflowEngineController));
router.get('/instances/my-approvals', authorize({ resource: 'workflow', action: 'approve' }), workflowEngineController.findMyApprovals.bind(workflowEngineController));
router.get('/instances/:id', authorize({ resource: 'workflow', action: 'read' }), workflowEngineController.findInstanceById.bind(workflowEngineController));
router.post('/instances/start', authorize({ resource: 'workflow', action: 'create' }), validate(startWorkflowInstanceSchema), workflowEngineController.startInstance.bind(workflowEngineController));
router.post('/instances/:id/actions', authorize({ resource: 'workflow', action: 'approve' }), validate(workflowActionSchema), workflowEngineController.applyAction.bind(workflowEngineController));
router.post('/instances/bulk-approve', authorize({ resource: 'workflow', action: 'approve' }), validate(bulkApprovalSchema), workflowEngineController.bulkApproval.bind(workflowEngineController));

// Approval delegation (checklist §6) — self-service: the delegator is the caller.
router.get('/delegations', workflowEngineController.listDelegations.bind(workflowEngineController));
router.post('/delegations', validate(createDelegationSchema), workflowEngineController.createDelegation.bind(workflowEngineController));
router.patch('/delegations/:id/revoke', workflowEngineController.revokeDelegation.bind(workflowEngineController));

export default router;
