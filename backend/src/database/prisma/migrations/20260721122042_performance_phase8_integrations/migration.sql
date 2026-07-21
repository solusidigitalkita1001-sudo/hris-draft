-- AlterTable
ALTER TABLE `performance_calibration_sessions` ADD COLUMN `performanceMethodVersionId` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `performance_development_recommendations` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `period_id` VARCHAR(36) NOT NULL,
    `result_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `course_id` VARCHAR(36) NULL,
    `enrollment_id` VARCHAR(36) NULL,
    `type` ENUM('TRAINING', 'DEVELOPMENT_PLAN', 'SUCCESSION', 'COMPENSATION') NOT NULL DEFAULT 'TRAINING',
    `priority` VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDING', 'ASSIGNED', 'ENROLLED', 'COMPLETED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
    `source_rule_label` VARCHAR(255) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `assigned_by_id` VARCHAR(36) NULL,
    `assigned_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `performanceMethodVersionId` VARCHAR(36) NULL,

    INDEX `performance_development_recommendations_company_id_period_id_idx`(`company_id`, `period_id`, `status`),
    INDEX `performance_development_recommendations_result_id_idx`(`result_id`),
    INDEX `performance_development_recommendations_employee_id_idx`(`employee_id`),
    INDEX `performance_development_recommendations_course_id_idx`(`course_id`),
    INDEX `performance_development_recommendations_enrollment_id_idx`(`enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_result_attachments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `result_id` VARCHAR(36) NULL,
    `dispute_id` VARCHAR(36) NULL,
    `document_id` VARCHAR(36) NOT NULL,
    `attachment_type` ENUM('RESULT', 'DISPUTE') NOT NULL,
    `created_by_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `performance_result_attachments_document_id_key`(`document_id`),
    INDEX `performance_result_attachments_company_id_result_id_idx`(`company_id`, `result_id`),
    INDEX `performance_result_attachments_company_id_dispute_id_idx`(`company_id`, `dispute_id`),
    INDEX `performance_result_attachments_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_automation_schedules` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `period_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `reminder_target` ENUM('UNACKNOWLEDGED_RESULTS', 'OPEN_DISPUTES', 'ALL') NOT NULL,
    `cadence_hours` INTEGER NOT NULL,
    `queue_job_id` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(3) NULL,
    `next_run_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `performanceMethodVersionId` VARCHAR(36) NULL,

    INDEX `performance_automation_schedules_company_id_period_id_is_act_idx`(`company_id`, `period_id`, `is_active`),
    INDEX `performance_automation_schedules_queue_job_id_idx`(`queue_job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_calibration_sessions` ADD CONSTRAINT `performance_calibration_sessions_performanceMethodVersionId_fkey` FOREIGN KEY (`performanceMethodVersionId`) REFERENCES `performance_method_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `performance_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_result_id_fkey` FOREIGN KEY (`result_id`) REFERENCES `performance_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `training_courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `training_enrollments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_assigned_by_id_fkey` FOREIGN KEY (`assigned_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_development_recommendations` ADD CONSTRAINT `performance_development_recommendations_performanceMethodVe_fkey` FOREIGN KEY (`performanceMethodVersionId`) REFERENCES `performance_method_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_attachments` ADD CONSTRAINT `performance_result_attachments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_attachments` ADD CONSTRAINT `performance_result_attachments_result_id_fkey` FOREIGN KEY (`result_id`) REFERENCES `performance_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_attachments` ADD CONSTRAINT `performance_result_attachments_dispute_id_fkey` FOREIGN KEY (`dispute_id`) REFERENCES `performance_result_disputes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_attachments` ADD CONSTRAINT `performance_result_attachments_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_result_attachments` ADD CONSTRAINT `performance_result_attachments_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_automation_schedules` ADD CONSTRAINT `performance_automation_schedules_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_automation_schedules` ADD CONSTRAINT `performance_automation_schedules_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `performance_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_automation_schedules` ADD CONSTRAINT `performance_automation_schedules_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_automation_schedules` ADD CONSTRAINT `performance_automation_schedules_performanceMethodVersionId_fkey` FOREIGN KEY (`performanceMethodVersionId`) REFERENCES `performance_method_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
