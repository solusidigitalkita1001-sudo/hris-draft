-- CreateTable
CREATE TABLE `performance_methods` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `latest_version_number` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_methods_company_id_status_idx`(`company_id`, `status`),
    UNIQUE INDEX `performance_methods_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_method_versions` (
    `id` VARCHAR(36) NOT NULL,
    `method_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `summary` TEXT NULL,
    `score_aggregation` ENUM('WEIGHTED_AVERAGE', 'SUM', 'AVERAGE') NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    `minimum_score` DECIMAL(5, 2) NULL,
    `maximum_score` DECIMAL(5, 2) NULL,
    `normalization_rule` JSON NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_method_versions_company_id_status_idx`(`company_id`, `status`),
    INDEX `performance_method_versions_method_id_status_idx`(`method_id`, `status`),
    UNIQUE INDEX `performance_method_versions_method_id_version_number_key`(`method_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_components` (
    `id` VARCHAR(36) NOT NULL,
    `method_version_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` ENUM('KPI', 'GOAL', 'COMPETENCY', 'BEHAVIOR', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `description` TEXT NULL,
    `weight` DECIMAL(5, 2) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `performance_components_company_id_type_idx`(`company_id`, `type`),
    INDEX `performance_components_method_version_id_sort_order_idx`(`method_version_id`, `sort_order`),
    UNIQUE INDEX `performance_components_method_version_id_code_key`(`method_version_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_periods` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `method_id` VARCHAR(36) NOT NULL,
    `method_version_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `review_deadline` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'READY', 'PUBLISHED', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `description` TEXT NULL,
    `readiness_summary` JSON NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `performance_periods_company_id_status_idx`(`company_id`, `status`),
    INDEX `performance_periods_method_id_idx`(`method_id`),
    INDEX `performance_periods_method_version_id_idx`(`method_version_id`),
    UNIQUE INDEX `performance_periods_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `performance_methods` ADD CONSTRAINT `performance_methods_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_method_versions` ADD CONSTRAINT `performance_method_versions_method_id_fkey` FOREIGN KEY (`method_id`) REFERENCES `performance_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_method_versions` ADD CONSTRAINT `performance_method_versions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_components` ADD CONSTRAINT `performance_components_method_version_id_fkey` FOREIGN KEY (`method_version_id`) REFERENCES `performance_method_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_components` ADD CONSTRAINT `performance_components_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_periods` ADD CONSTRAINT `performance_periods_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_periods` ADD CONSTRAINT `performance_periods_method_id_fkey` FOREIGN KEY (`method_id`) REFERENCES `performance_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_periods` ADD CONSTRAINT `performance_periods_method_version_id_fkey` FOREIGN KEY (`method_version_id`) REFERENCES `performance_method_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
