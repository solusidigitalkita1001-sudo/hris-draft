-- Workflow template versioning (checklist §6): structural edits now create a
-- new template version instead of deleting/recreating stages in place, which
-- nulled the stageId on every in-flight instance step. Additive columns only.

ALTER TABLE `workflow_templates`
  ADD COLUMN `version` INT NOT NULL DEFAULT 1,
  ADD COLUMN `previous_version_id` VARCHAR(36) NULL,
  ADD COLUMN `effective_from` DATETIME(3) NULL;
