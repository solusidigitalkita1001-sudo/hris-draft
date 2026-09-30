-- CreateTable
CREATE TABLE `employment_contracts` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `contract_number` VARCHAR(100) NULL,
    `type` ENUM('PKWT', 'PKWTT', 'PROBATION') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `status` ENUM('ACTIVE', 'ENDED', 'TERMINATED', 'RENEWED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `last_reminder_at` DATETIME(3) NULL,
    `last_reminder_days` INTEGER NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `employment_contracts_company_id_idx`(`company_id`),
    INDEX `employment_contracts_employee_id_idx`(`employee_id`),
    INDEX `employment_contracts_end_date_idx`(`end_date`),
    INDEX `employment_contracts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
