-- `assets.asset_code` was unique across the whole installation. Nothing in the
-- application ever wanted that: every asset lookup already filters by
-- company_id, and an asset tag is a thing the customer prints on its own
-- stickers. Two tenants that both label their first laptop `AST-LAP-001` are
-- not in conflict -- they are two companies with their own asset registers.
--
-- Same shape as 20261007100000_tenant_scoped_employee_number, and the same
-- reasoning about safety: relaxing a global unique index to a composite one
-- cannot fail on existing data, because if (asset_code) was unique then
-- (company_id, asset_code) is unique too. The drop looks the old index up by
-- column rather than by name so it cannot silently no-op against a database
-- whose index was named otherwise, and every step is guarded so this replays
-- from an empty database as well as against one that already has the new shape.

-- 1. Drop the single-column unique index on asset_code, whatever it is called.
SET @old_unique := (
  SELECT index_name FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'assets'
     AND column_name = 'asset_code' AND non_unique = 0
   GROUP BY index_name HAVING COUNT(*) = 1
   LIMIT 1);

SET @drop_unique := IF(@old_unique IS NULL, 'DO 0',
  CONCAT('DROP INDEX `', @old_unique, '` ON `assets`'));
PREPARE stmt FROM @drop_unique; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add the tenant-scoped unique key, using Prisma's default name for
--    @@unique([companyId, assetCode]).
SET @add_unique := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'assets'
     AND index_name = 'assets_company_id_asset_code_key') = 0,
  'CREATE UNIQUE INDEX `assets_company_id_asset_code_key` ON `assets`(`company_id`, `asset_code`)',
  'DO 0');
PREPARE stmt FROM @add_unique; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. The schema declares @@index([assetCode]) for lookups by code alone, which
--    the dropped unique index may have been serving. Make sure it exists.
SET @add_index := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'assets'
     AND index_name = 'assets_asset_code_idx') = 0,
  'CREATE INDEX `assets_asset_code_idx` ON `assets`(`asset_code`)',
  'DO 0');
PREPARE stmt FROM @add_index; EXECUTE stmt; DEALLOCATE PREPARE stmt;
