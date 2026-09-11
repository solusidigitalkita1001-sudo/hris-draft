-- Career movement approval routing (checklist §9). Existing rows were applied
-- without approval, so default APPROVED preserves their meaning; new movements
-- created with a workflow template start PENDING. Additive only.

ALTER TABLE `employee_career_transactions`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `approved_by` VARCHAR(36) NULL,
  ADD COLUMN `approved_at` DATETIME(3) NULL;
