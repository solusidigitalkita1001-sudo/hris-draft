-- AlterTable
ALTER TABLE `performance_planning_assignments` ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `decision_notes` TEXT NULL,
    ADD COLUMN `execution_snapshot` JSON NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `submission_notes` TEXT NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'COMPLETED', 'REASSIGNED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `performance_planning_targets` ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `current_text` TEXT NULL,
    ADD COLUMN `current_value` DECIMAL(12, 2) NULL,
    ADD COLUMN `progress_percent` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `reviewer_comment` TEXT NULL,
    ADD COLUMN `self_comment` TEXT NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `performance_planning_target_progresses` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `assignment_id` VARCHAR(36) NOT NULL,
    `target_id` VARCHAR(36) NOT NULL,
    `actor_id` VARCHAR(36) NULL,
    `progress_percent` INTEGER NOT NULL DEFAULT 0,
    `current_value` DECIMAL(12, 2) NULL,
    `current_text` TEXT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `performance_planning_target_progresses_company_id_assignment_idx`(`company_id`, `assignment_id`),
    INDEX `performance_planning_target_progresses_target_id_idx`(`target_id`),
    INDEX `performance_planning_target_progresses_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_planning_evidences` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `assignment_id` VARCHAR(36) NOT NULL,
    `target_id` VARCHAR(36) NOT NULL,
    `uploaded_by_id` VARCHAR(36) NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `performance_planning_evidences_company_id_assignment_id_idx`(`company_id`, `assignment_id`),
    INDEX `performance_planning_evidences_target_id_idx`(`target_id`),
    INDEX `performance_planning_evidences_uploaded_by_id_idx`(`uploaded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_planning_target_progresses` ADD CONSTRAINT `performance_planning_target_progresses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_target_progresses` ADD CONSTRAINT `performance_planning_target_progresses_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `performance_planning_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_target_progresses` ADD CONSTRAINT `performance_planning_target_progresses_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `performance_planning_targets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_target_progresses` ADD CONSTRAINT `performance_planning_target_progresses_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_evidences` ADD CONSTRAINT `performance_planning_evidences_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_evidences` ADD CONSTRAINT `performance_planning_evidences_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `performance_planning_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_evidences` ADD CONSTRAINT `performance_planning_evidences_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `performance_planning_targets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_evidences` ADD CONSTRAINT `performance_planning_evidences_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
