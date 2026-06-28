-- CreateTable
CREATE TABLE `business_trips` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `destination` VARCHAR(255) NOT NULL,
    `purpose` TEXT NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `estimated_cost` DECIMAL(15, 2) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `business_trips_company_id_status_idx`(`company_id`, `status`),
    INDEX `business_trips_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `travel_advances` (
    `id` VARCHAR(36) NOT NULL,
    `trip_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `disbursed_at` DATETIME(3) NULL,
    `reconciled` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_advances_trip_id_idx`(`trip_id`),
    INDEX `travel_advances_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_claims` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `trip_id` VARCHAR(36) NULL,
    `category` ENUM('TRANSPORTATION', 'HOTEL', 'MEAL', 'ENTERTAINMENT', 'OPERATIONAL') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `description` TEXT NULL,
    `expense_date` DATETIME(3) NOT NULL,
    `receipt_file_path` VARCHAR(500) NULL,
    `ocr_extracted_amount` DECIMAL(15, 2) NULL,
    `status` ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expense_claims_company_id_status_idx`(`company_id`, `status`),
    INDEX `expense_claims_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `expense_claims_trip_id_idx`(`trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_approvals` (
    `id` VARCHAR(36) NOT NULL,
    `claim_id` VARCHAR(36) NOT NULL,
    `approver_id` VARCHAR(36) NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `expense_approvals_claim_id_idx`(`claim_id`),
    INDEX `expense_approvals_approver_id_idx`(`approver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reimbursements` (
    `id` VARCHAR(36) NOT NULL,
    `claim_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `method` ENUM('TRANSFER', 'PAYROLL') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `processed_by` VARCHAR(36) NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `payroll_detail_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reimbursements_claim_id_idx`(`claim_id`),
    INDEX `reimbursements_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_trips` ADD CONSTRAINT `business_trips_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_trips` ADD CONSTRAINT `business_trips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `travel_advances` ADD CONSTRAINT `travel_advances_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `business_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `travel_advances` ADD CONSTRAINT `travel_advances_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_claims` ADD CONSTRAINT `expense_claims_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_claims` ADD CONSTRAINT `expense_claims_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_claims` ADD CONSTRAINT `expense_claims_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `business_trips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_approvals` ADD CONSTRAINT `expense_approvals_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `expense_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_claim_id_fkey` FOREIGN KEY (`claim_id`) REFERENCES `expense_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
