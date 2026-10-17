-- Koreksi nominal atas payslip yang sudah dibayar (GAP-14/21b).
-- Lihat docs/superpowers/specs/2026-10-08-payroll-correction-run-design.md.

-- CreateTable
CREATE TABLE `payroll_corrections` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `source_payslip_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `remaining_amount` DECIMAL(15, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `registered_by` VARCHAR(36) NULL,
    `applied_run_id` VARCHAR(36) NULL,
    `payslip_id` VARCHAR(36) NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_corrections_company_id_status_idx`(`company_id`, `status`),
    INDEX `payroll_corrections_employee_id_idx`(`employee_id`),
    INDEX `payroll_corrections_source_payslip_id_idx`(`source_payslip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_corrections` ADD CONSTRAINT `payroll_corrections_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_corrections` ADD CONSTRAINT `payroll_corrections_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_corrections` ADD CONSTRAINT `payroll_corrections_source_payslip_id_fkey` FOREIGN KEY (`source_payslip_id`) REFERENCES `payslips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
