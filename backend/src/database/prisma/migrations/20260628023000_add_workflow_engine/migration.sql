-- CreateTable
CREATE TABLE `workflow_templates` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `approval_type` VARCHAR(100) NOT NULL,
    `resource` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_templates_company_id_is_active_idx`(`company_id`, `is_active`),
    INDEX `workflow_templates_approval_type_idx`(`approval_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_stages` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `level` INTEGER NOT NULL,
    `approver_type` ENUM('ROLE', 'USER', 'AUTO') NOT NULL,
    `approver_role_code` VARCHAR(50) NULL,
    `approver_id` VARCHAR(36) NULL,
    `backup_approver_role_code` VARCHAR(50) NULL,
    `backup_approver_id` VARCHAR(36) NULL,
    `sla_hours` INTEGER NOT NULL DEFAULT 72,
    `allow_escalation` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_stages_template_id_level_idx`(`template_id`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_condition_rules` (
    `id` VARCHAR(36) NOT NULL,
    `stage_id` VARCHAR(36) NOT NULL,
    `field` VARCHAR(100) NOT NULL,
    `operator` ENUM('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS') NOT NULL,
    `value` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workflow_condition_rules_stage_id_idx`(`stage_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_instances` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `approval_type` VARCHAR(100) NOT NULL,
    `reference_type` VARCHAR(100) NOT NULL,
    `reference_id` VARCHAR(36) NOT NULL,
    `requester_id` VARCHAR(36) NOT NULL,
    `payload` JSON NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `current_level` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_instances_company_id_status_idx`(`company_id`, `status`),
    INDEX `workflow_instances_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `workflow_instances_requester_id_idx`(`requester_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_instance_steps` (
    `id` VARCHAR(36) NOT NULL,
    `instance_id` VARCHAR(36) NOT NULL,
    `stage_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `level` INTEGER NOT NULL,
    `approver_type` ENUM('ROLE', 'USER', 'AUTO') NOT NULL,
    `approver_role_code` VARCHAR(50) NULL,
    `approver_id` VARCHAR(36) NULL,
    `backup_approver_role_code` VARCHAR(50) NULL,
    `backup_approver_id` VARCHAR(36) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `acted_by` VARCHAR(36) NULL,
    `acted_at` DATETIME(3) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_instance_steps_instance_id_is_current_idx`(`instance_id`, `is_current`),
    INDEX `workflow_instance_steps_approver_id_idx`(`approver_id`),
    INDEX `workflow_instance_steps_approver_role_code_idx`(`approver_role_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_instance_logs` (
    `id` VARCHAR(36) NOT NULL,
    `instance_id` VARCHAR(36) NOT NULL,
    `step_id` VARCHAR(36) NULL,
    `action` ENUM('STARTED', 'APPROVED', 'REJECTED', 'ESCALATED', 'COMMENTED') NOT NULL,
    `actor_id` VARCHAR(36) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workflow_instance_logs_instance_id_idx`(`instance_id`),
    INDEX `workflow_instance_logs_step_id_idx`(`step_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `workflow_templates` ADD CONSTRAINT `workflow_templates_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_stages` ADD CONSTRAINT `workflow_stages_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_condition_rules` ADD CONSTRAINT `workflow_condition_rules_stage_id_fkey` FOREIGN KEY (`stage_id`) REFERENCES `workflow_stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instances` ADD CONSTRAINT `workflow_instances_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instances` ADD CONSTRAINT `workflow_instances_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instance_steps` ADD CONSTRAINT `workflow_instance_steps_instance_id_fkey` FOREIGN KEY (`instance_id`) REFERENCES `workflow_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instance_steps` ADD CONSTRAINT `workflow_instance_steps_stage_id_fkey` FOREIGN KEY (`stage_id`) REFERENCES `workflow_stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instance_logs` ADD CONSTRAINT `workflow_instance_logs_instance_id_fkey` FOREIGN KEY (`instance_id`) REFERENCES `workflow_instances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instance_logs` ADD CONSTRAINT `workflow_instance_logs_step_id_fkey` FOREIGN KEY (`step_id`) REFERENCES `workflow_instance_steps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
