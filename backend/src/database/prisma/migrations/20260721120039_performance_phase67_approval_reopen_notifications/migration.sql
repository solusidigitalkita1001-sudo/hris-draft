-- AlterTable
ALTER TABLE `performance_results` ADD COLUMN `final_approval_note` TEXT NULL,
    ADD COLUMN `final_approved_at` DATETIME(3) NULL,
    ADD COLUMN `final_approved_by_id` VARCHAR(36) NULL,
    ADD COLUMN `last_reminder_at` DATETIME(3) NULL,
    ADD COLUMN `reminder_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reopen_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reopen_reason` TEXT NULL,
    ADD COLUMN `reopened_at` DATETIME(3) NULL,
    ADD COLUMN `reopened_by_id` VARCHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_final_approved_by_id_fkey` FOREIGN KEY (`final_approved_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_results` ADD CONSTRAINT `performance_results_reopened_by_id_fkey` FOREIGN KEY (`reopened_by_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
