-- Offer management (checklist §27): versioned job offers with approval and
-- candidate response; hire now requires an ACCEPTED offer and records the
-- agreed salary as the employee's first EmployeeSalary row.

CREATE TABLE `offers` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `application_id` VARCHAR(36) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `status` ENUM('DRAFT', 'APPROVED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
  `base_salary` DECIMAL(15, 2) NOT NULL,
  `allowance` DECIMAL(15, 2) NULL,
  `grade` VARCHAR(50) NULL,
  `position_id` VARCHAR(36) NULL,
  `employment_type` VARCHAR(50) NOT NULL DEFAULT 'PROBATION',
  `probation_months` INT NULL,
  `join_date` DATETIME(3) NULL,
  `expiry_date` DATETIME(3) NULL,
  `approved_by` VARCHAR(36) NULL,
  `approved_at` DATETIME(3) NULL,
  `responded_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `offers_application_id_version_key`(`application_id`, `version`),
  INDEX `offers_company_id_idx`(`company_id`),
  INDEX `offers_application_id_idx`(`application_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `offers` ADD CONSTRAINT `offers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `offers` ADD CONSTRAINT `offers_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
