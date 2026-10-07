-- 20261002100000_tenant_scoped_leave_and_benefit_codes memindahkan
-- `leave_types.code` dan `benefit_plans.code` ke indeks unik per perusahaan, tapi
-- men-drop indeks lamanya **berdasarkan nama** (`leave_types_code_key`,
-- `benefit_plans_code_key`) di dalam guard `information_schema`. Kalau nama di
-- sebuah database ternyata berbeda -- dibuat tangan, atau oleh versi Prisma yang
-- menamai lain -- guard itu membuat DROP-nya jadi `DO 0`, sementara
-- `CREATE UNIQUE INDEX` kompositnya tetap sukses. Hasilnya migrasi hijau di atas
-- database yang **masih** memaksa kode unik se-instalasi, dan tenant kedua tetap
-- tertolak di katalog cutinya sendiri.
--
-- CI tidak bisa menangkap itu: CI selalu memulai dari database kosong, di mana
-- namanya memang nama default Prisma. Jadi ini migrasi korektif yang mencari
-- indeks lama **berdasarkan kolom**, seperti tiga migrasi sesudahnya
-- (20261007100000, 20261007110000, 20261007120000).
--
-- Aman di semua keadaan:
--   * database yang sudah benar  -> tidak ada indeks unik single-column, `DO 0`
--   * database yang namanya beda -> indeksnya ketemu dan di-drop
--   * data lama                  -> kalau (code) unik, (company_id, code) pasti unik
-- dan tidak ada data yang bisa menyalahi, karena indeks globalnya justru yang
-- masih memaksa keunikan saat migrasi ini jalan.

-- leave_types (LeaveType)
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'leave_types'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `leave_types`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'leave_types'
     AND index_name = 'leave_types_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `leave_types_company_id_code_key` ON `leave_types`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'leave_types'
     AND index_name = 'leave_types_code_idx') = 0,
  'CREATE INDEX `leave_types_code_idx` ON `leave_types`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- benefit_plans (BenefitPlan)
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'benefit_plans'
     AND column_name = 'code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @sql := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `benefit_plans`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'benefit_plans'
     AND index_name = 'benefit_plans_company_id_code_key') = 0,
  'CREATE UNIQUE INDEX `benefit_plans_company_id_code_key` ON `benefit_plans`(`company_id`, `code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'benefit_plans'
     AND index_name = 'benefit_plans_code_idx') = 0,
  'CREATE INDEX `benefit_plans_code_idx` ON `benefit_plans`(`code`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
