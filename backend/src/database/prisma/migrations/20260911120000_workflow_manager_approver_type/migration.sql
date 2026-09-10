-- Add MANAGER to the workflow approver type enum: stages configured with
-- MANAGER resolve to the subject employee's reporting-line manager at
-- instance start (see workflow-engine.repository.resolveManagerApprover).
-- Purely additive; existing rows keep their values.

ALTER TABLE `workflow_stages`
  MODIFY COLUMN `approver_type` ENUM('ROLE', 'USER', 'AUTO', 'MANAGER') NOT NULL;

ALTER TABLE `workflow_instance_steps`
  MODIFY COLUMN `approver_type` ENUM('ROLE', 'USER', 'AUTO', 'MANAGER') NOT NULL;
