-- AlterTable
ALTER TABLE `performance_periods` ADD COLUMN `planning_published_at` DATETIME(3) NULL,
    ADD COLUMN `planning_summary` JSON NULL;

-- CreateTable
CREATE TABLE `performance_planning_assignments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `period_id` VARCHAR(36) NOT NULL,
    `method_id` VARCHAR(36) NOT NULL,
    `method_version_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `reviewer_id` VARCHAR(36) NULL,
    `approver_id` VARCHAR(36) NULL,
    `assignment_source` ENUM('MANUAL', 'AUTO_FROM_ORG') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('DRAFT', 'PUBLISHED', 'REASSIGNED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `reassignment_reason` TEXT NULL,
    `employee_snapshot` JSON NULL,
    `org_snapshot` JSON NULL,
    `planning_snapshot` JSON NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_planning_assignments_company_id_period_id_status_idx`(`company_id`, `period_id`, `status`),
    INDEX `performance_planning_assignments_employee_id_idx`(`employee_id`),
    INDEX `performance_planning_assignments_reviewer_id_idx`(`reviewer_id`),
    INDEX `performance_planning_assignments_approver_id_idx`(`approver_id`),
    INDEX `performance_planning_assignments_method_version_id_idx`(`method_version_id`),
    UNIQUE INDEX `performance_planning_assignments_period_id_employee_id_key`(`period_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_planning_targets` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `assignment_id` VARCHAR(36) NOT NULL,
    `component_id` VARCHAR(36) NULL,
    `indicator_id` VARCHAR(36) NULL,
    `formula_id` VARCHAR(36) NULL,
    `reviewer_id` VARCHAR(36) NULL,
    `approver_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `target_value` DECIMAL(12, 2) NULL,
    `target_text` TEXT NULL,
    `weight` DECIMAL(5, 2) NOT NULL,
    `frequency` ENUM('ONCE', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM') NOT NULL DEFAULT 'ONCE',
    `evidence_required` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `config` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_planning_targets_company_id_assignment_id_status_idx`(`company_id`, `assignment_id`, `status`),
    INDEX `performance_planning_targets_component_id_idx`(`component_id`),
    INDEX `performance_planning_targets_indicator_id_idx`(`indicator_id`),
    INDEX `performance_planning_targets_formula_id_idx`(`formula_id`),
    INDEX `performance_planning_targets_reviewer_id_idx`(`reviewer_id`),
    INDEX `performance_planning_targets_approver_id_idx`(`approver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `performance_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_method_id_fkey` FOREIGN KEY (`method_id`) REFERENCES `performance_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_method_version_id_fkey` FOREIGN KEY (`method_version_id`) REFERENCES `performance_method_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_assignments` ADD CONSTRAINT `performance_planning_assignments_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `performance_planning_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `performance_components`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_indicator_id_fkey` FOREIGN KEY (`indicator_id`) REFERENCES `performance_indicators`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_formula_id_fkey` FOREIGN KEY (`formula_id`) REFERENCES `performance_formulas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_planning_targets` ADD CONSTRAINT `performance_planning_targets_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
