import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { workflowEngineController } from './workflow-engine.controller';
import {
  createWorkflowTemplateSchema,
  startWorkflowInstanceSchema,
  updateWorkflowTemplateSchema,
  workflowActionSchema,
} from './workflow-engine.dto';

const router = Router();

router.use(authenticate);

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

export default router;
