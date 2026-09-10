-- attendance_face_logs was referenced by 20260903090000_face_match_rate_limit_index
-- but never created by any migration (the table only existed on databases that
-- were provisioned outside migrate deploy). This migration backfills the table.
--
-- It is deliberately idempotent: environments where the table was already
-- created by hand must pass through unchanged.
--
-- attendance_face_logs_rate_limit_idx is intentionally NOT created here;
-- it is owned by 20260903090000_face_match_rate_limit_index.

CREATE TABLE IF NOT EXISTS `attendance_face_logs` (
    `id` VARCHAR(36) NOT NULL,
    `attendance_id` VARCHAR(36) NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `selfie_url` VARCHAR(500) NULL,
    `similarity_score` DECIMAL(5, 4) NOT NULL,
    `is_face_match` BOOLEAN NOT NULL DEFAULT false,
    `liveness_verdict` ENUM('PASS', 'STATIC', 'BLUR', 'MANIPULATED', 'NO_DATA') NOT NULL DEFAULT 'NO_DATA',
    `mock_verdict` ENUM('PASS', 'LIKELY_REAL', 'SUSPICIOUS', 'CONFIRMED_FAKE') NOT NULL DEFAULT 'LIKELY_REAL',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_face_logs_attendance_id_idx`(`attendance_id`),
    INDEX `attendance_face_logs_employee_id_idx`(`employee_id`),
    INDEX `attendance_face_logs_company_id_idx`(`company_id`),
    INDEX `attendance_face_logs_is_face_match_idx`(`is_face_match`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys, guarded so a pre-existing hand-made table is left untouched.

SET @noop = 'SELECT 1';

SET @sql = IFNULL(
    (
        SELECT 'ALTER TABLE `attendance_face_logs` ADD CONSTRAINT `attendance_face_logs_attendance_id_fkey` FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
        FROM DUAL
        WHERE 0 = (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'attendance_face_logs'
              AND CONSTRAINT_NAME = 'attendance_face_logs_attendance_id_fkey'
        )
    ),
    @noop
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IFNULL(
    (
        SELECT 'ALTER TABLE `attendance_face_logs` ADD CONSTRAINT `attendance_face_logs_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
        FROM DUAL
        WHERE 0 = (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'attendance_face_logs'
              AND CONSTRAINT_NAME = 'attendance_face_logs_employee_id_fkey'
        )
    ),
    @noop
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IFNULL(
    (
        SELECT 'ALTER TABLE `attendance_face_logs` ADD CONSTRAINT `attendance_face_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
        FROM DUAL
        WHERE 0 = (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'attendance_face_logs'
              AND CONSTRAINT_NAME = 'attendance_face_logs_company_id_fkey'
        )
    ),
    @noop
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
