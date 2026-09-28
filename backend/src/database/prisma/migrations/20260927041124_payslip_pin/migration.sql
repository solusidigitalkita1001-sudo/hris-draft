-- AlterTable
ALTER TABLE `users` ADD COLUMN `payslip_pin_failed_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `payslip_pin_hash` VARCHAR(255) NULL,
    ADD COLUMN `payslip_pin_locked_until` DATETIME(3) NULL;
