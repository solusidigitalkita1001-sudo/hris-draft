-- Phase 5 (checklist §24, §28, §30): hire idempotency link and resignation
-- effects marker. Additive only.

ALTER TABLE `job_applications`
  ADD COLUMN `hired_employee_id` VARCHAR(36) NULL;

ALTER TABLE `resignations`
  ADD COLUMN `effects_applied_at` DATETIME(3) NULL;
