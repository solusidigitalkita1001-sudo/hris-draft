-- Dynamic data scopes (checklist §9 RBAC propagation): OWN_* scopes resolve
-- from the requester's current org unit so access follows a transfer.
--
-- role_data_scopes and role_menu_accesses were never created by any migration
-- (schema-only), so this migration backfills them idempotently before the
-- OWN_* enum values are used — otherwise migrate deploy fails with "table
-- doesn't exist" (P3018) on any migration-built database. FKs are declared
-- inline so a freshly-created table matches the datamodel; on a database that
-- already had the tables (via db push) the CREATE is skipped and only the
-- enum is widened.

CREATE TABLE IF NOT EXISTS `role_data_scopes` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `role_code` VARCHAR(50) NOT NULL,
  `resource` VARCHAR(100) NOT NULL DEFAULT 'ALL',
  `scope_type` ENUM(
    'ALL', 'COMPANY_ONLY', 'BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY',
    'EMPLOYEE_SELF', 'MANAGER_TEAM', 'OWN_BRANCH', 'OWN_DEPARTMENT', 'OWN_SUB_DEPARTMENT'
  ) NOT NULL,
  `scope_value` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `role_data_scopes_company_id_role_code_resource_key`(`company_id`, `role_code`, `resource`),
  INDEX `role_data_scopes_company_id_role_code_idx`(`company_id`, `role_code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `role_data_scopes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_menu_accesses` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `role_code` VARCHAR(50) NOT NULL,
  `menu_path` VARCHAR(255) NOT NULL,
  `access_type` ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `role_menu_accesses_company_id_role_code_menu_path_key`(`company_id`, `role_code`, `menu_path`),
  INDEX `role_menu_accesses_company_id_role_code_idx`(`company_id`, `role_code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `role_menu_accesses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Widen the enum for databases where role_data_scopes already existed with the
-- old set (no-op on the freshly-created table above).
ALTER TABLE `role_data_scopes`
  MODIFY COLUMN `scope_type` ENUM(
    'ALL', 'COMPANY_ONLY', 'BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY',
    'EMPLOYEE_SELF', 'MANAGER_TEAM', 'OWN_BRANCH', 'OWN_DEPARTMENT', 'OWN_SUB_DEPARTMENT'
  ) NOT NULL;
