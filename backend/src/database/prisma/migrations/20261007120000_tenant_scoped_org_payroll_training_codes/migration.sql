-- Eight more `code` columns that were unique across the whole installation while
-- the models they belong to are per-company: branches, divisions, departments,
-- sub_departments, positions, payroll_periods, training_categories and
-- training_courses. A company whose departments have been called HR and FIN for
-- ten years could not keep those names if any other tenant got there first.
--
-- This is the shape proven by 20261007100000_tenant_scoped_employee_number and
-- 20261007110000_tenant_scoped_asset_code, applied eight times. Safety is the
-- same argument: relaxing a global unique index to a composite one cannot fail
-- on existing data, because if (code) was unique then (company_id, code) is
-- unique too. Each drop looks the old index up by column rather than by name so
-- it cannot silently no-op against a database whose index was named otherwise,
-- and every step is guarded so this replays from an empty database as well as
-- against one that already has the new shape.
--
-- `salary_components` is not here: it already had @@unique([companyId, code]).
-- `roles` is not here either, and must not be copied into this pattern --
-- Role.companyId is nullable, and in MySQL several rows with company_id IS NULL
-- all pass a composite unique index, which would lose the uniqueness that
-- platform-level roles depend on.

-- branches: cabang
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'branches'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `branches`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'branches'
     AND index_name = 'branches_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `branches_company_id_code_key` ON `branches`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'branches'
     AND index_name = 'branches_code_idx') = 0,
  'CREATE INDEX `branches_code_idx` ON `branches`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- divisions: divisi
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'divisions'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `divisions`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'divisions'
     AND index_name = 'divisions_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `divisions_company_id_code_key` ON `divisions`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'divisions'
     AND index_name = 'divisions_code_idx') = 0,
  'CREATE INDEX `divisions_code_idx` ON `divisions`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- departments: departemen
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'departments'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `departments`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'departments'
     AND index_name = 'departments_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `departments_company_id_code_key` ON `departments`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'departments'
     AND index_name = 'departments_code_idx') = 0,
  'CREATE INDEX `departments_code_idx` ON `departments`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sub_departments: sub-departemen
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'sub_departments'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `sub_departments`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'sub_departments'
     AND index_name = 'sub_departments_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `sub_departments_company_id_code_key` ON `sub_departments`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'sub_departments'
     AND index_name = 'sub_departments_code_idx') = 0,
  'CREATE INDEX `sub_departments_code_idx` ON `sub_departments`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- positions: jabatan
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'positions'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `positions`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'positions'
     AND index_name = 'positions_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `positions_company_id_code_key` ON `positions`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'positions'
     AND index_name = 'positions_code_idx') = 0,
  'CREATE INDEX `positions_code_idx` ON `positions`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payroll_periods: periode payroll
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'payroll_periods'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `payroll_periods`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'payroll_periods'
     AND index_name = 'payroll_periods_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `payroll_periods_company_id_code_key` ON `payroll_periods`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'payroll_periods'
     AND index_name = 'payroll_periods_code_idx') = 0,
  'CREATE INDEX `payroll_periods_code_idx` ON `payroll_periods`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_categories: kategori training
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'training_categories'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `training_categories`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'training_categories'
     AND index_name = 'training_categories_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `training_categories_company_id_code_key` ON `training_categories`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'training_categories'
     AND index_name = 'training_categories_code_idx') = 0,
  'CREATE INDEX `training_categories_code_idx` ON `training_categories`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- training_courses: kursus training
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'training_courses'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `training_courses`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'training_courses'
     AND index_name = 'training_courses_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `training_courses_company_id_code_key` ON `training_courses`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'training_courses'
     AND index_name = 'training_courses_code_idx') = 0,
  'CREATE INDEX `training_courses_code_idx` ON `training_courses`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
