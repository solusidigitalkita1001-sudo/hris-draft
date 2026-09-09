-- CreateTable
CREATE TABLE `payroll_formula_versions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `component_id` VARCHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `expression` TEXT NOT NULL,
    `expression_hash` CHAR(64) NOT NULL,
    `engine_version` INTEGER NOT NULL DEFAULT 1,
    `effective_from` DATE NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `created_by` VARCHAR(36) NOT NULL,
    `previewed_at` DATETIME(3) NULL,
    `published_by` VARCHAR(36) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_formula_versions_company_id_status_effective_from_idx`(`company_id`, `status`, `effective_from`),
    UNIQUE INDEX `payroll_formula_versions_component_id_version_key`(`component_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_formula_audits` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `version_id` VARCHAR(36) NOT NULL,
    `actor_id` VARCHAR(36) NOT NULL,
    `action` VARCHAR(30) NOT NULL,
    `expression_hash` CHAR(64) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `request_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_formula_audits_company_id_version_id_idx`(`company_id`, `version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_formula_calculations` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `run_id` VARCHAR(36) NOT NULL,
    `payslip_id` VARCHAR(36) NOT NULL,
    `component_id` VARCHAR(36) NOT NULL,
    `version_id` VARCHAR(36) NOT NULL,
    `expression` TEXT NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `inputs` JSON NOT NULL,
    `dependencies` JSON NOT NULL,
    `engine_version` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_formula_calculations_company_id_run_id_idx`(`company_id`, `run_id`),
    UNIQUE INDEX `payroll_formula_calculations_payslip_id_component_id_key`(`payslip_id`, `component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_formula_versions` ADD CONSTRAINT `payroll_formula_versions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_versions` ADD CONSTRAINT `payroll_formula_versions_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_audits` ADD CONSTRAINT `payroll_formula_audits_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_audits` ADD CONSTRAINT `payroll_formula_audits_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `payroll_formula_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_calculations` ADD CONSTRAINT `payroll_formula_calculations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_calculations` ADD CONSTRAINT `payroll_formula_calculations_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_calculations` ADD CONSTRAINT `payroll_formula_calculations_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_calculations` ADD CONSTRAINT `payroll_formula_calculations_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_formula_calculations` ADD CONSTRAINT `payroll_formula_calculations_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `payroll_formula_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

