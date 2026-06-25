-- CreateTable
CREATE TABLE `onboarding_checklists` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `item_name` VARCHAR(150) NOT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'Equipment',
    `pic_id` VARCHAR(36) NULL,
    `due_date` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `onboarding_checklists_company_id_idx`(`company_id`),
    INDEX `onboarding_checklists_employee_id_idx`(`employee_id`),
    INDEX `onboarding_checklists_pic_id_idx`(`pic_id`),
    INDEX `onboarding_checklists_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resignations` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `resign_date` DATETIME(3) NOT NULL,
    `last_working_date` DATETIME(3) NOT NULL,
    `reason` TEXT NULL,
    `notice_period_days` INTEGER NOT NULL DEFAULT 30,
    `status` VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `resignations_company_id_idx`(`company_id`),
    INDEX `resignations_employee_id_idx`(`employee_id`),
    INDEX `resignations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exit_clearances` (
    `id` VARCHAR(36) NOT NULL,
    `resignation_id` VARCHAR(36) NOT NULL,
    `department` VARCHAR(50) NOT NULL,
    `checklist_item` VARCHAR(150) NOT NULL,
    `pic_id` VARCHAR(36) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `cleared_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exit_clearances_resignation_id_idx`(`resignation_id`),
    INDEX `exit_clearances_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NULL,
    `group_id` VARCHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `depreciation_method` VARCHAR(50) NOT NULL DEFAULT 'STRAIGHT_LINE',
    `useful_life_months` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_categories_company_id_idx`(`company_id`),
    INDEX `asset_categories_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NULL,
    `asset_code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `serial_number` VARCHAR(100) NULL,
    `purchase_date` DATETIME(3) NULL,
    `purchase_value` DECIMAL(15, 2) NULL,
    `current_value` DECIMAL(15, 2) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    `branch_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `assets_asset_code_key`(`asset_code`),
    INDEX `assets_company_id_idx`(`company_id`),
    INDEX `assets_asset_code_idx`(`asset_code`),
    INDEX `assets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_assignments` (
    `id` VARCHAR(36) NOT NULL,
    `asset_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `condition_at_assign` VARCHAR(20) NOT NULL DEFAULT 'GOOD',
    `returned_at` DATETIME(3) NULL,
    `condition_at_return` VARCHAR(20) NULL,
    `notes` TEXT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_assignments_asset_id_idx`(`asset_id`),
    INDEX `asset_assignments_employee_id_idx`(`employee_id`),
    INDEX `asset_assignments_returned_at_idx`(`returned_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `onboarding_checklists` ADD CONSTRAINT `onboarding_checklists_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_checklists` ADD CONSTRAINT `onboarding_checklists_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_checklists` ADD CONSTRAINT `onboarding_checklists_pic_id_fkey` FOREIGN KEY (`pic_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resignations` ADD CONSTRAINT `resignations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resignations` ADD CONSTRAINT `resignations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_clearances` ADD CONSTRAINT `exit_clearances_resignation_id_fkey` FOREIGN KEY (`resignation_id`) REFERENCES `resignations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_categories` ADD CONSTRAINT `asset_categories_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `company_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
