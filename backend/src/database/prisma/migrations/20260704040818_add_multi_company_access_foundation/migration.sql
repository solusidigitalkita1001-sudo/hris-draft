-- CreateTable
CREATE TABLE `employee_company_assignments` (
    `id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `assignment_type` ENUM('PRIMARY', 'SECONDMENT', 'TRANSFER') NOT NULL DEFAULT 'PRIMARY',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `reason` TEXT NULL,
    `approved_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_company_assignments_employee_id_idx`(`employee_id`),
    INDEX `employee_company_assignments_company_id_idx`(`company_id`),
    INDEX `employee_company_assignments_assignment_type_idx`(`assignment_type`),
    INDEX `employee_company_assignments_start_date_idx`(`start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_company_access` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `group_id` VARCHAR(36) NULL,
    `access_scope` ENUM('GROUP_WIDE', 'SINGLE_COMPANY') NOT NULL DEFAULT 'SINGLE_COMPANY',
    `role_override` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_company_access_company_id_idx`(`company_id`),
    INDEX `user_company_access_group_id_idx`(`group_id`),
    INDEX `user_company_access_access_scope_idx`(`access_scope`),
    UNIQUE INDEX `user_company_access_user_id_company_id_key`(`user_id`, `company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_company_assignments` ADD CONSTRAINT `employee_company_assignments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_company_assignments` ADD CONSTRAINT `employee_company_assignments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_company_assignments` ADD CONSTRAINT `employee_company_assignments_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_company_access` ADD CONSTRAINT `user_company_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_company_access` ADD CONSTRAINT `user_company_access_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_company_access` ADD CONSTRAINT `user_company_access_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `company_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
