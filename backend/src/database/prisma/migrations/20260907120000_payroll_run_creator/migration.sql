-- Preserve legacy rows without guessing historical actors.
ALTER TABLE `payroll_runs` ADD COLUMN `created_by` VARCHAR(36) NULL;
