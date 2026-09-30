-- CreateTable
CREATE TABLE `payroll_arrears` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `source_period_id` VARCHAR(36) NOT NULL,
    `gross_amount` DECIMAL(15, 2) NOT NULL,
    `basis` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `registered_by` VARCHAR(36) NULL,
    `payslip_id` VARCHAR(36) NULL,
    `applied_run_id` VARCHAR(36) NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_arrears_employee_id_source_period_id_key`(`employee_id`, `source_period_id`),
    INDEX `payroll_arrears_company_id_idx`(`company_id`),
    INDEX `payroll_arrears_status_idx`(`status`),
    INDEX `payroll_arrears_source_period_id_idx`(`source_period_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_arrears` ADD CONSTRAINT `payroll_arrears_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_arrears` ADD CONSTRAINT `payroll_arrears_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_arrears` ADD CONSTRAINT `payroll_arrears_source_period_id_fkey` FOREIGN KEY (`source_period_id`) REFERENCES `payroll_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_arrears` ADD CONSTRAINT `payroll_arrears_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_arrears` ADD CONSTRAINT `payroll_arrears_applied_run_id_fkey` FOREIGN KEY (`applied_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
