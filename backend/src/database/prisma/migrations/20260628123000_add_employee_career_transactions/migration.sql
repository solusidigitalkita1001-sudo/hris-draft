-- CreateTable
CREATE TABLE `employee_career_transactions` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `transaction_type` ENUM('PROMOTION', 'DEMOTION', 'MUTATION', 'TRANSFER', 'ROTATION', 'ACTING_ASSIGNMENT', 'STATUS_CHANGE') NOT NULL,
  `effective_date` DATETIME(3) NOT NULL,
  `from_branch_id` VARCHAR(36) NULL,
  `to_branch_id` VARCHAR(36) NULL,
  `from_department_id` VARCHAR(36) NULL,
  `to_department_id` VARCHAR(36) NULL,
  `from_position_id` VARCHAR(36) NULL,
  `to_position_id` VARCHAR(36) NULL,
  `from_employment_type` ENUM('PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING') NULL,
  `to_employment_type` ENUM('PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING') NULL,
  `reference_number` VARCHAR(100) NULL,
  `reason` TEXT NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  INDEX `employee_career_transactions_employee_id_idx`(`employee_id`),
  INDEX `employee_career_transactions_company_id_idx`(`company_id`),
  INDEX `employee_career_transactions_transaction_type_idx`(`transaction_type`),
  INDEX `employee_career_transactions_effective_date_idx`(`effective_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_from_branch_id_fkey`
  FOREIGN KEY (`from_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_to_branch_id_fkey`
  FOREIGN KEY (`to_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_from_department_id_fkey`
  FOREIGN KEY (`from_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_to_department_id_fkey`
  FOREIGN KEY (`to_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_from_position_id_fkey`
  FOREIGN KEY (`from_position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_to_position_id_fkey`
  FOREIGN KEY (`to_position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `employee_career_transactions`
  ADD CONSTRAINT `employee_career_transactions_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
