-- CreateTable
CREATE TABLE `leave_encashments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `leave_type_id` VARCHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `days` INTEGER NOT NULL,
    `gross_amount` DECIMAL(15, 2) NOT NULL,
    `basis` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `requested_by` VARCHAR(36) NULL,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejected_reason` VARCHAR(255) NULL,
    `payslip_id` VARCHAR(36) NULL,
    `applied_run_id` VARCHAR(36) NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_encashments_company_id_idx`(`company_id`),
    INDEX `leave_encashments_employee_id_idx`(`employee_id`),
    INDEX `leave_encashments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leave_encashments` ADD CONSTRAINT `leave_encashments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_encashments` ADD CONSTRAINT `leave_encashments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_encashments` ADD CONSTRAINT `leave_encashments_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_encashments` ADD CONSTRAINT `leave_encashments_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
