-- CreateTable
CREATE TABLE `payroll_payment_batches` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `payroll_run_id` VARCHAR(36) NOT NULL,
    `run_name` VARCHAR(255) NOT NULL,
    `run_created_by` VARCHAR(36) NOT NULL,
    `run_approved_by` VARCHAR(36) NOT NULL,
    `status` ENUM('DRAFT', 'EXPORTED', 'PROCESSING', 'PAID', 'PARTIALLY_FAILED', 'FAILED', 'RECONCILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `transaction_count` INTEGER NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `exported_at` DATETIME(3) NULL,
    `reconciled_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_payment_batches_payroll_run_id_key`(`payroll_run_id`),
    INDEX `payroll_payment_batches_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_payment_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `batch_id` VARCHAR(36) NOT NULL,
    `payslip_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `employee_name` VARCHAR(510) NOT NULL,
    `bank_code` VARCHAR(20) NOT NULL,
    `bank_name` VARCHAR(255) NOT NULL,
    `account_number` VARCHAR(100) NOT NULL,
    `account_holder` VARCHAR(255) NOT NULL,
    `reference_no` VARCHAR(100) NOT NULL,
    `expected_amount` DECIMAL(15, 2) NOT NULL,
    `paid_amount` DECIMAL(15, 2) NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `bank_reference` VARCHAR(100) NULL,
    `failure_reason` VARCHAR(500) NULL,
    `recorded_by` VARCHAR(36) NULL,
    `recorded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_payment_transactions_company_id_status_idx`(`company_id`, `status`),
    UNIQUE INDEX `payroll_payment_transactions_batch_id_payslip_id_key`(`batch_id`, `payslip_id`),
    UNIQUE INDEX `payroll_payment_transactions_company_id_bank_reference_key`(`company_id`, `bank_reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_payment_logs` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `batch_id` VARCHAR(36) NOT NULL,
    `transaction_id` VARCHAR(36) NULL,
    `actor_id` VARCHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `from_status` VARCHAR(30) NULL,
    `to_status` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_payment_logs_company_id_batch_id_idx`(`company_id`, `batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_payment_operations` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(128) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `result` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payroll_payment_operations_company_id_key_key`(`company_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_loan_deduction_snapshots` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `run_id` VARCHAR(36) NOT NULL,
    `payslip_id` VARCHAR(36) NOT NULL,
    `loan_id` VARCHAR(36) NOT NULL,
    `installment_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_loan_deduction_snapshots_run_id_idx`(`run_id`),
    INDEX `payroll_loan_deduction_snapshots_company_id_idx`(`company_id`),
    UNIQUE INDEX `payroll_loan_deduction_snapshots_payslip_id_installment_id_key`(`payslip_id`, `installment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_payment_batches` ADD CONSTRAINT `payroll_payment_batches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_batches` ADD CONSTRAINT `payroll_payment_batches_payroll_run_id_fkey` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_transactions` ADD CONSTRAINT `payroll_payment_transactions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_transactions` ADD CONSTRAINT `payroll_payment_transactions_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `payroll_payment_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_transactions` ADD CONSTRAINT `payroll_payment_transactions_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_logs` ADD CONSTRAINT `payroll_payment_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_logs` ADD CONSTRAINT `payroll_payment_logs_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `payroll_payment_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_payment_operations` ADD CONSTRAINT `payroll_payment_operations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_loan_deduction_snapshots` ADD CONSTRAINT `payroll_loan_deduction_snapshots_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_loan_deduction_snapshots` ADD CONSTRAINT `payroll_loan_deduction_snapshots_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_loan_deduction_snapshots` ADD CONSTRAINT `payroll_loan_deduction_snapshots_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_loan_deduction_snapshots` ADD CONSTRAINT `payroll_loan_deduction_snapshots_installment_id_fkey` FOREIGN KEY (`installment_id`) REFERENCES `loan_installments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

