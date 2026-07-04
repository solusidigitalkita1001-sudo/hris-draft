-- AlterTable
ALTER TABLE `attendances` ADD COLUMN `attendance_policy_id` VARCHAR(36) NULL,
    ADD COLUMN `branch_id` VARCHAR(36) NULL,
    ADD COLUMN `check_in_latitude` DOUBLE NULL,
    ADD COLUMN `check_in_longitude` DOUBLE NULL,
    ADD COLUMN `check_out_latitude` DOUBLE NULL,
    ADD COLUMN `check_out_longitude` DOUBLE NULL,
    ADD COLUMN `distance_meters` INTEGER NULL,
    ADD COLUMN `exception_reason` TEXT NULL,
    ADD COLUMN `exception_type` ENUM('OUT_OF_RADIUS', 'OFF_DAY_ATTENDANCE', 'MISSING_POLICY', 'MISSING_GPS', 'METHOD_NOT_ALLOWED', 'INVALID_BRANCH_CONTEXT') NULL,
    ADD COLUMN `is_exception` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_within_radius` BOOLEAN NULL,
    ADD COLUMN `method` ENUM('FINGERPRINT', 'MOBILE_GPS', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `policy_snapshot` JSON NULL,
    ADD COLUMN `requires_review` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resolved_calendar_id` VARCHAR(36) NULL,
    ADD COLUMN `scheduled_work_end` VARCHAR(5) NULL,
    ADD COLUMN `scheduled_work_start` VARCHAR(5) NULL,
    ADD COLUMN `source` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `branch_attendance_policies` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NOT NULL,
    `attendance_method` ENUM('FINGERPRINT', 'MOBILE_GPS', 'BOTH', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `gps_latitude` DOUBLE NULL,
    `gps_longitude` DOUBLE NULL,
    `gps_radius_meters` INTEGER NULL,
    `allow_outside_radius` BOOLEAN NOT NULL DEFAULT false,
    `outside_radius_action` ENUM('REJECT', 'FLAG', 'REVIEW') NOT NULL DEFAULT 'REVIEW',
    `late_tolerance_minutes` INTEGER NOT NULL DEFAULT 0,
    `early_checkout_tolerance_minutes` INTEGER NOT NULL DEFAULT 0,
    `allow_holiday_attendance` BOOLEAN NOT NULL DEFAULT false,
    `allow_weekend_attendance` BOOLEAN NOT NULL DEFAULT false,
    `auto_absent_enabled` BOOLEAN NOT NULL DEFAULT false,
    `auto_checkout_enabled` BOOLEAN NOT NULL DEFAULT false,
    `requires_selfie` BOOLEAN NOT NULL DEFAULT false,
    `requires_location` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `branch_attendance_policies_branch_id_key`(`branch_id`),
    INDEX `branch_attendance_policies_company_id_idx`(`company_id`),
    INDEX `branch_attendance_policies_attendance_method_idx`(`attendance_method`),
    INDEX `branch_attendance_policies_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `attendances_branch_id_idx` ON `attendances`(`branch_id`);

-- CreateIndex
CREATE INDEX `attendances_attendance_policy_id_idx` ON `attendances`(`attendance_policy_id`);

-- CreateIndex
CREATE INDEX `attendances_method_idx` ON `attendances`(`method`);

-- CreateIndex
CREATE INDEX `attendances_requires_review_idx` ON `attendances`(`requires_review`);

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendance_policy_id_fkey` FOREIGN KEY (`attendance_policy_id`) REFERENCES `branch_attendance_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_attendance_policies` ADD CONSTRAINT `branch_attendance_policies_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_attendance_policies` ADD CONSTRAINT `branch_attendance_policies_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
