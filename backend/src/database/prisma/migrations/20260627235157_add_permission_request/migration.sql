-- CreateTable
CREATE TABLE `permission_requests` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `type` ENUM('SICK', 'PERSONAL', 'LATE', 'EARLY_LEAVE', 'LEAVE_OFFICE', 'BUSINESS_TRIP', 'WORK_FROM_HOME', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `duration` DOUBLE NOT NULL DEFAULT 0,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `approver_id` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `permission_requests_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `permission_requests_company_id_idx`(`company_id`),
    INDEX `permission_requests_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `permission_requests` ADD CONSTRAINT `permission_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permission_requests` ADD CONSTRAINT `permission_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
