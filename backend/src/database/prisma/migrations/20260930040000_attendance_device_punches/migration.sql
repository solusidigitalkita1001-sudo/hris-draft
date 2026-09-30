-- CreateTable
CREATE TABLE `attendance_devices` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NULL,
    `name` VARCHAR(150) NOT NULL,
    `serial_number` VARCHAR(100) NOT NULL,
    `secret_hash` VARCHAR(64) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `attendance_devices_company_id_serial_number_key`(`company_id`, `serial_number`),
    INDEX `attendance_devices_company_id_idx`(`company_id`),
    INDEX `attendance_devices_branch_id_idx`(`branch_id`),
    INDEX `attendance_devices_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_device_punches` (
    `id` VARCHAR(36) NOT NULL,
    `device_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NULL,
    `employee_code` VARCHAR(50) NOT NULL,
    `external_id` VARCHAR(100) NOT NULL,
    `punched_at` DATETIME(3) NOT NULL,
    `direction` ENUM('AUTO', 'IN', 'OUT') NOT NULL DEFAULT 'AUTO',
    `status` ENUM('PENDING', 'APPLIED', 'DUPLICATE', 'UNMATCHED_EMPLOYEE', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejection_reason` VARCHAR(255) NULL,
    `attendance_id` VARCHAR(36) NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_device_punches_device_id_external_id_key`(`device_id`, `external_id`),
    INDEX `attendance_device_punches_company_id_idx`(`company_id`),
    INDEX `attendance_device_punches_employee_id_idx`(`employee_id`),
    INDEX `attendance_device_punches_punched_at_idx`(`punched_at`),
    INDEX `attendance_device_punches_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_devices` ADD CONSTRAINT `attendance_devices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_devices` ADD CONSTRAINT `attendance_devices_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_device_punches` ADD CONSTRAINT `attendance_device_punches_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `attendance_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_device_punches` ADD CONSTRAINT `attendance_device_punches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_device_punches` ADD CONSTRAINT `attendance_device_punches_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_device_punches` ADD CONSTRAINT `attendance_device_punches_attendance_id_fkey` FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
