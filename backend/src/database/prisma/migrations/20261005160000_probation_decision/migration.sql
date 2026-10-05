-- GAP-20. Probation monitoring existed — the three-month legal cap and the
-- 30/14/7 day reminders are real — but the decision at the end of it was not
-- recordable. The only move available was the generic contract status change
-- to ENDED, TERMINATED or RENEWED, which cannot distinguish "passed probation
-- and is now permanent" from "the contract simply ran out", and keeps no
-- record of who decided or why. That distinction is exactly what somebody
-- asks about a year later.
--
-- Additive and nullable throughout: an existing contract has no probation
-- decision, which is true of every contract that is not a probation and of
-- every probation not yet reviewed.

SET @col := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'employment_contracts'
     AND column_name = 'probation_decision') = 0,
  'ALTER TABLE `employment_contracts`
     ADD COLUMN `probation_decision` ENUM(''PASS'',''EXTEND'',''FAIL'') NULL,
     ADD COLUMN `probation_decided_by` VARCHAR(36) NULL,
     ADD COLUMN `probation_decided_at` DATETIME(3) NULL,
     ADD COLUMN `probation_notes` TEXT NULL',
  'DO 0');
PREPARE stmt FROM @col; EXECUTE stmt; DEALLOCATE PREPARE stmt;
