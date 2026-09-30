-- CreateTable
CREATE TABLE `collective_leaves` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `leave_type_id` VARCHAR(36) NOT NULL,
    `unpaid_leave_type_id` VARCHAR(36) NOT NULL,
    `status` ENUM('DECLARED', 'APPLIED', 'CANCELLED') NOT NULL DEFAULT 'DECLARED',
    `notes` TEXT NULL,
    `declared_by` VARCHAR(36) NULL,
    `applied_at` DATETIME(3) NULL,
    `applied_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collective_leaves_company_id_date_key`(`company_id`, `date`),
    INDEX `collective_leaves_company_id_idx`(`company_id`),
    INDEX `collective_leaves_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collective_leave_exclusions` (
    `id` VARCHAR(36) NOT NULL,
    `collective_leave_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `collective_leave_exclusions_collective_leave_id_branch_id_key`(`collective_leave_id`, `branch_id`),
    INDEX `collective_leave_exclusions_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `leave_requests` ADD COLUMN `collective_leave_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `leave_requests_collective_leave_id_employee_id_key` ON `leave_requests`(`collective_leave_id`, `employee_id`);

-- AddForeignKey
ALTER TABLE `collective_leaves` ADD CONSTRAINT `collective_leaves_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collective_leaves` ADD CONSTRAINT `collective_leaves_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collective_leaves` ADD CONSTRAINT `collective_leaves_unpaid_leave_type_id_fkey` FOREIGN KEY (`unpaid_leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collective_leave_exclusions` ADD CONSTRAINT `collective_leave_exclusions_collective_leave_id_fkey` FOREIGN KEY (`collective_leave_id`) REFERENCES `collective_leaves`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collective_leave_exclusions` ADD CONSTRAINT `collective_leave_exclusions_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_collective_leave_id_fkey` FOREIGN KEY (`collective_leave_id`) REFERENCES `collective_leaves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
