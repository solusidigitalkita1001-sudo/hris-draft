-- Leave type and benefit plan codes were unique across the whole installation,
-- not per company. Standard codes are exactly the point of those two tables —
-- ANNUAL, SICK, UNPAID, BPJS-KES, BPJS-TK — so the first tenant to claim them
-- claimed them for everybody, and onboarding a second customer failed on its
-- own leave catalogue. Every other company-scoped code is machine-generated
-- with a random suffix and never collided, which is why this went unnoticed.
--
-- Relaxing a global unique index to a composite one cannot fail on existing
-- data: if (code) was unique then (company_id, code) is unique too. The index
-- names are Prisma's defaults, and the guards keep this replayable from an
-- empty database as well as against a database that already has them.

SET @drop_leave := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'leave_types'
     AND index_name = 'leave_types_code_key') > 0,
  'DROP INDEX `leave_types_code_key` ON `leave_types`', 'DO 0');
PREPARE stmt FROM @drop_leave; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_leave := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'leave_types'
     AND index_name = 'leave_types_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `leave_types_company_id_code_key` ON `leave_types`(`company_id`, `code`)', 'DO 0');
PREPARE stmt FROM @add_leave; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @drop_benefit := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'benefit_plans'
     AND index_name = 'benefit_plans_code_key') > 0,
  'DROP INDEX `benefit_plans_code_key` ON `benefit_plans`', 'DO 0');
PREPARE stmt FROM @drop_benefit; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_benefit := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'benefit_plans'
     AND index_name = 'benefit_plans_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `benefit_plans_company_id_code_key` ON `benefit_plans`(`company_id`, `code`)', 'DO 0');
PREPARE stmt FROM @add_benefit; EXECUTE stmt; DEALLOCATE PREPARE stmt;
