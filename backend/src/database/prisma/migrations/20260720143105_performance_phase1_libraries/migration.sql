-- AlterTable
ALTER TABLE `performance_method_versions` ADD COLUMN `grade_rule_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `performance_formulas` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `strategy` ENUM('ACHIEVEMENT_PERCENTAGE', 'LOWER_IS_BETTER', 'MANUAL_RATING', 'AVERAGE', 'WEIGHTED_AVERAGE', 'CUSTOM') NOT NULL,
    `expression` TEXT NULL,
    `rounding_mode` ENUM('ROUND', 'FLOOR', 'CEIL') NOT NULL DEFAULT 'ROUND',
    `rounding_precision` INTEGER NOT NULL DEFAULT 2,
    `minimum_score` DECIMAL(5, 2) NULL,
    `maximum_score` DECIMAL(5, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_formulas_company_id_strategy_is_active_idx`(`company_id`, `strategy`, `is_active`),
    UNIQUE INDEX `performance_formulas_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_indicators` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `formula_id` VARCHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(100) NULL,
    `perspective` VARCHAR(100) NULL,
    `measurement_type` ENUM('NUMBER', 'PERCENTAGE', 'CURRENCY', 'DURATION', 'BOOLEAN', 'RATING', 'TEXT', 'CUSTOM_FORMULA') NOT NULL,
    `target_type` ENUM('MONTHLY', 'QUARTERLY', 'SEMESTER', 'YEARLY', 'CUSTOM') NOT NULL,
    `direction` ENUM('HIGHER_BETTER', 'LOWER_BETTER', 'RANGE', 'EXACT', 'MANUAL') NOT NULL,
    `unit` VARCHAR(50) NULL,
    `default_weight` DECIMAL(5, 2) NULL DEFAULT 0,
    `minimum_value` DECIMAL(12, 2) NULL,
    `maximum_value` DECIMAL(12, 2) NULL,
    `evidence_required` BOOLEAN NOT NULL DEFAULT false,
    `review_required` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_indicators_company_id_category_is_active_idx`(`company_id`, `category`, `is_active`),
    INDEX `performance_indicators_formula_id_idx`(`formula_id`),
    UNIQUE INDEX `performance_indicators_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_grade_rules` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_grade_rules_company_id_is_active_idx`(`company_id`, `is_active`),
    UNIQUE INDEX `performance_grade_rules_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_grade_ranges` (
    `id` VARCHAR(36) NOT NULL,
    `grade_rule_id` VARCHAR(36) NOT NULL,
    `label` VARCHAR(50) NOT NULL,
    `minimum` DECIMAL(5, 2) NOT NULL,
    `maximum` DECIMAL(5, 2) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_grade_ranges_grade_rule_id_sort_order_idx`(`grade_rule_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_method_versions` ADD CONSTRAINT `performance_method_versions_grade_rule_id_fkey` FOREIGN KEY (`grade_rule_id`) REFERENCES `performance_grade_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_formulas` ADD CONSTRAINT `performance_formulas_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_indicators` ADD CONSTRAINT `performance_indicators_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_indicators` ADD CONSTRAINT `performance_indicators_formula_id_fkey` FOREIGN KEY (`formula_id`) REFERENCES `performance_formulas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_grade_rules` ADD CONSTRAINT `performance_grade_rules_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_grade_ranges` ADD CONSTRAINT `performance_grade_ranges_grade_rule_id_fkey` FOREIGN KEY (`grade_rule_id`) REFERENCES `performance_grade_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
