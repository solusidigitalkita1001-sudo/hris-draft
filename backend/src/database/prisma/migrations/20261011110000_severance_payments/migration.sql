-- Pembayaran pesangon lewat run SEVERANCE (GAP-42).
-- Lihat docs/superpowers/plans/2026-10-11-severance-run.md.

-- CreateTable
CREATE TABLE `severance_payments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `resignation_id` VARCHAR(36) NOT NULL,
    `gross_amount` DECIMAL(15, 2) NOT NULL,
    `tax_amount` DECIMAL(15, 2) NOT NULL,
    `net_amount` DECIMAL(15, 2) NOT NULL,
    `basis` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `registered_by` VARCHAR(36) NULL,
    `applied_run_id` VARCHAR(36) NULL,
    `payslip_id` VARCHAR(36) NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `severance_payments_resignation_id_key`(`resignation_id`),
    INDEX `severance_payments_company_id_status_idx`(`company_id`, `status`),
    INDEX `severance_payments_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `severance_payments` ADD CONSTRAINT `severance_payments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `severance_payments` ADD CONSTRAINT `severance_payments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `severance_payments` ADD CONSTRAINT `severance_payments_resignation_id_fkey` FOREIGN KEY (`resignation_id`) REFERENCES `resignations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
