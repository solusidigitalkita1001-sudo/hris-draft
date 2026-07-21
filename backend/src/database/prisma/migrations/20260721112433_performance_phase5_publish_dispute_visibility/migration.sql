-- AlterTable
ALTER TABLE `performance_results` ADD COLUMN `acknowledged_at` DATETIME(3) NULL,
    ADD COLUMN `acknowledgement_note` TEXT NULL,
    ADD COLUMN `dispute_deadline` DATETIME(3) NULL,
    ADD COLUMN `publish_notes` TEXT NULL,
    ADD COLUMN `published_by_id` VARCHAR(36) NULL,
    ADD COLUMN `visibility_policy` JSON NULL;

-- CreateTable
CREATE TABLE `performance_result_disputes` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `result_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `status` ENUM('OPEN', 'RESPONDED', 'RESOLVED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `response_message` TEXT NULL,
    `responded_by_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `responded_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,

    INDEX `performance_result_disputes_company_id_result_id_status_idx`(`company_id`, `result_id`, `status`),
    INDEX `performance_result_disputes_employee_id_idx`(`employee_id`),
    INDEX `performance_result_disputes_responded_by_id_idx`(`responded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_published_by_id_fkey` FOREIGN KEY (`published_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_disputes` ADD CONSTRAINT `performance_result_disputes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_disputes` ADD CONSTRAINT `performance_result_disputes_result_id_fkey` FOREIGN KEY (`result_id`) REFERENCES `performance_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_disputes` ADD CONSTRAINT `performance_result_disputes_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_disputes` ADD CONSTRAINT `performance_result_disputes_responded_by_id_fkey` FOREIGN KEY (`responded_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
