-- Custom field per perusahaan (GAP-39), V1 entitas EMPLOYEE.

-- CreateTable
CREATE TABLE `custom_field_definitions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `entity` ENUM('EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `key` VARCHAR(64) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `type` ENUM('TEXT', 'NUMBER', 'DATE', 'SELECT') NOT NULL,
    `options` JSON NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `custom_field_definitions_company_id_entity_key_key`(`company_id`, `entity`, `key`),
    INDEX `custom_field_definitions_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_custom_field_values` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `definition_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `value` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_custom_field_values_definition_id_employee_id_key`(`definition_id`, `employee_id`),
    INDEX `employee_custom_field_values_company_id_idx`(`company_id`),
    INDEX `employee_custom_field_values_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `custom_field_definitions` ADD CONSTRAINT `custom_field_definitions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_custom_field_values` ADD CONSTRAINT `employee_custom_field_values_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_custom_field_values` ADD CONSTRAINT `employee_custom_field_values_definition_id_fkey` FOREIGN KEY (`definition_id`) REFERENCES `custom_field_definitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_custom_field_values` ADD CONSTRAINT `employee_custom_field_values_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
