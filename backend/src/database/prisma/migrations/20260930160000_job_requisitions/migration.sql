-- CreateTable
CREATE TABLE `job_requisitions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `department_id` VARCHAR(36) NULL,
    `position_id` VARCHAR(36) NULL,
    `code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `headcount` INTEGER NOT NULL DEFAULT 1,
    `reason` TEXT NOT NULL,
    `budget_per_hire` DECIMAL(15, 2) NULL,
    `target_start_date` DATE NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `requested_by` VARCHAR(36) NULL,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejected_reason` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `job_requisitions_code_key`(`code`),
    INDEX `job_requisitions_company_id_idx`(`company_id`),
    INDEX `job_requisitions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `job_postings` ADD COLUMN `requisition_id` VARCHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `job_requisitions` ADD CONSTRAINT `job_requisitions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requisitions` ADD CONSTRAINT `job_requisitions_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_requisitions` ADD CONSTRAINT `job_requisitions_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_postings` ADD CONSTRAINT `job_postings_requisition_id_fkey` FOREIGN KEY (`requisition_id`) REFERENCES `job_requisitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
