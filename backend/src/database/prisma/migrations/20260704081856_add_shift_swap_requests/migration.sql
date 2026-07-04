-- CreateTable
CREATE TABLE `shift_swap_requests` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `requester_employee_id` VARCHAR(36) NOT NULL,
    `target_employee_id` VARCHAR(36) NOT NULL,
    `approver_employee_id` VARCHAR(36) NOT NULL,
    `shift_date` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `approval_notes` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `shift_swap_requests_company_id_status_idx`(`company_id`, `status`),
    INDEX `shift_swap_requests_requester_employee_id_status_idx`(`requester_employee_id`, `status`),
    INDEX `shift_swap_requests_target_employee_id_status_idx`(`target_employee_id`, `status`),
    INDEX `shift_swap_requests_approver_employee_id_status_idx`(`approver_employee_id`, `status`),
    INDEX `shift_swap_requests_shift_date_idx`(`shift_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_shift_overrides` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `shift_swap_request_id` VARCHAR(36) NULL,
    `date` DATE NOT NULL,
    `source` VARCHAR(50) NOT NULL DEFAULT 'SHIFT_SWAP',
    `original_schedule` JSON NOT NULL,
    `override_schedule` JSON NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `employee_shift_overrides_company_id_date_idx`(`company_id`, `date`),
    INDEX `employee_shift_overrides_employee_id_date_idx`(`employee_id`, `date`),
    INDEX `employee_shift_overrides_shift_swap_request_id_idx`(`shift_swap_request_id`),
    UNIQUE INDEX `employee_shift_overrides_employee_id_date_key`(`employee_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `shift_swap_requests` ADD CONSTRAINT `shift_swap_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_swap_requests` ADD CONSTRAINT `shift_swap_requests_requester_employee_id_fkey` FOREIGN KEY (`requester_employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_swap_requests` ADD CONSTRAINT `shift_swap_requests_target_employee_id_fkey` FOREIGN KEY (`target_employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_swap_requests` ADD CONSTRAINT `shift_swap_requests_approver_employee_id_fkey` FOREIGN KEY (`approver_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_shift_overrides` ADD CONSTRAINT `employee_shift_overrides_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_shift_overrides` ADD CONSTRAINT `employee_shift_overrides_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_shift_overrides` ADD CONSTRAINT `employee_shift_overrides_shift_swap_request_id_fkey` FOREIGN KEY (`shift_swap_request_id`) REFERENCES `shift_swap_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
