-- `employees.employee_number` was unique across the whole installation, while
-- every check in the application is already scoped per company
-- (`findByEmployeeNumber(companyId, number)`, and the CSV import's duplicate
-- scan). Code and database therefore disagreed: a second tenant reusing a
-- number the first tenant holds passes validation and then dies on the index
-- with a raw constraint error instead of a clean conflict.
--
-- It also made a customer's own numbering unusable. A company migrating from
-- another payroll cannot keep `EMP-001` if anybody else already has it, which
-- is the one thing it is guaranteed to ask for.
--
-- Relaxing a global unique index to a composite one cannot fail on existing
-- data: if (employee_number) was unique then (company_id, employee_number) is
-- unique too. The drop looks the old index up by column rather than by name so
-- it cannot silently no-op against a database whose index was named otherwise,
-- and every step is guarded so this replays from an empty database as well as
-- against one that already has the new shape.

-- 1. Drop the single-column unique index on employee_number, whatever it is called.
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'employees'
     AND column_name = 'employee_number' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @drop_unique := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `employees`'));
PREPARE stmt FROM @drop_unique; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add the tenant-scoped unique key, using Prisma's default name for
--    @@unique([companyId, employeeNumber]).
SET @add_unique := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'employees'
     AND index_name = 'employees_company_id_employee_number_key') = 0,
  'CREATE UNIQUE INDEX `employees_company_id_employee_number_key` ON `employees`(`company_id`, `employee_number`)',
  'DO 0');
PREPARE stmt FROM @add_unique; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. The schema declares @@index([employeeNumber]) for lookups by number alone,
--    which the dropped unique index may have been serving. Make sure it exists.
SET @add_index := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'employees'
     AND index_name = 'employees_employee_number_idx') = 0,
  'CREATE INDEX `employees_employee_number_idx` ON `employees`(`employee_number`)',
  'DO 0');
PREPARE stmt FROM @add_index; EXECUTE stmt; DEALLOCATE PREPARE stmt;
