-- CreateTable
CREATE TABLE `performance_results` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `period_id` VARCHAR(36) NOT NULL,
    `assignment_id` VARCHAR(36) NOT NULL,
    `method_id` VARCHAR(36) NOT NULL,
    `method_version_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `reviewer_id` VARCHAR(36) NULL,
    `approver_id` VARCHAR(36) NULL,
    `status` ENUM('CALCULATED', 'CALIBRATION_IN_PROGRESS', 'CALIBRATED', 'FINALIZED', 'PUBLISHED') NOT NULL DEFAULT 'CALCULATED',
    `raw_score` DECIMAL(7, 2) NULL,
    `normalized_score` DECIMAL(7, 2) NULL,
    `weighted_score` DECIMAL(7, 2) NULL,
    `final_score` DECIMAL(7, 2) NULL,
    `grade_code` VARCHAR(50) NULL,
    `grade_label` VARCHAR(100) NULL,
    `recommendation_summary` TEXT NULL,
    `recommendation_rules` JSON NULL,
    `calculation_version` INTEGER NOT NULL DEFAULT 1,
    `calculation_snapshot` JSON NULL,
    `calibration_snapshot` JSON NULL,
    `final_snapshot` JSON NULL,
    `override_reason` TEXT NULL,
    `overridden_by_id` VARCHAR(36) NULL,
    `calculated_at` DATETIME(3) NULL,
    `calibrated_at` DATETIME(3) NULL,
    `finalized_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `performance_results_assignment_id_key`(`assignment_id`),
    INDEX `performance_results_company_id_period_id_status_idx`(`company_id`, `period_id`, `status`),
    INDEX `performance_results_employee_id_idx`(`employee_id`),
    INDEX `performance_results_reviewer_id_idx`(`reviewer_id`),
    INDEX `performance_results_approver_id_idx`(`approver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_calibration_sessions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `period_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `scope` JSON NULL,
    `forced_distribution` JSON NULL,
    `notes` TEXT NULL,
    `created_by_id` VARCHAR(36) NULL,
    `opened_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `finalized_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_calibration_sessions_company_id_period_id_status_idx`(`company_id`, `period_id`, `status`),
    UNIQUE INDEX `performance_calibration_sessions_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_calibration_participants` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `session_id` VARCHAR(36) NOT NULL,
    `result_id` VARCHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'ADJUSTED', 'CONFIRMED') NOT NULL DEFAULT 'PENDING',
    `before_score` DECIMAL(7, 2) NULL,
    `before_grade_code` VARCHAR(50) NULL,
    `before_grade_label` VARCHAR(100) NULL,
    `after_score` DECIMAL(7, 2) NULL,
    `after_grade_code` VARCHAR(50) NULL,
    `after_grade_label` VARCHAR(100) NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_calibration_participants_company_id_session_id_s_idx`(`company_id`, `session_id`, `status`),
    INDEX `performance_calibration_participants_result_id_idx`(`result_id`),
    UNIQUE INDEX `performance_calibration_participants_session_id_result_id_key`(`session_id`, `result_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_calibration_decisions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `session_id` VARCHAR(36) NOT NULL,
    `participant_id` VARCHAR(36) NOT NULL,
    `result_id` VARCHAR(36) NOT NULL,
    `before_score` DECIMAL(7, 2) NULL,
    `before_grade_code` VARCHAR(50) NULL,
    `before_grade_label` VARCHAR(100) NULL,
    `after_score` DECIMAL(7, 2) NULL,
    `after_grade_code` VARCHAR(50) NULL,
    `after_grade_label` VARCHAR(100) NULL,
    `reason` TEXT NOT NULL,
    `changed_by_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `performance_calibration_decisions_company_id_session_id_idx`(`company_id`, `session_id`),
    INDEX `performance_calibration_decisions_participant_id_idx`(`participant_id`),
    INDEX `performance_calibration_decisions_result_id_idx`(`result_id`),
    INDEX `performance_calibration_decisions_changed_by_id_idx`(`changed_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `performance_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `performance_planning_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_method_id_fkey` FOREIGN KEY (`method_id`) REFERENCES `performance_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_method_version_id_fkey` FOREIGN KEY (`method_version_id`) REFERENCES `performance_method_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_overridden_by_id_fkey` FOREIGN KEY (`overridden_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_sessions` ADD CONSTRAINT `performance_calibration_sessions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_sessions` ADD CONSTRAINT `performance_calibration_sessions_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `performance_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_sessions` ADD CONSTRAINT `performance_calibration_sessions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_participants` ADD CONSTRAINT `performance_calibration_participants_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_participants` ADD CONSTRAINT `performance_calibration_participants_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `performance_calibration_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_participants` ADD CONSTRAINT `performance_calibration_participants_result_id_fkey` FOREIGN KEY (`result_id`) REFERENCES `performance_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_decisions` ADD CONSTRAINT `performance_calibration_decisions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_decisions` ADD CONSTRAINT `performance_calibration_decisions_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `performance_calibration_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_decisions` ADD CONSTRAINT `performance_calibration_decisions_participant_id_fkey` FOREIGN KEY (`participant_id`) REFERENCES `performance_calibration_participants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_decisions` ADD CONSTRAINT `performance_calibration_decisions_result_id_fkey` FOREIGN KEY (`result_id`) REFERENCES `performance_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_calibration_decisions` ADD CONSTRAINT `performance_calibration_decisions_changed_by_id_fkey` FOREIGN KEY (`changed_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
