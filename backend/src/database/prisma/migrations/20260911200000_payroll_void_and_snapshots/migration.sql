-- Phase 4 (checklist §14-§16): VOIDED run state (remedy for a wrong,
-- not-yet-approved run) and reproducibility snapshots. Additive only.

ALTER TABLE `payroll_runs`
  MODIFY COLUMN `status` ENUM('DRAFT', 'PROCESSING', 'COMPLETED', 'APPROVED', 'DISBURSED', 'VOIDED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `policy_snapshot` JSON NULL;

ALTER TABLE `payslips`
  ADD COLUMN `overtime_workday_hours` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `overtime_holiday_hours` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `employee_snapshot` JSON NULL;
