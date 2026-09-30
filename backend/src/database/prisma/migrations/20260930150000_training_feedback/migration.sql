-- CreateTable
CREATE TABLE `training_feedback` (
    `id` VARCHAR(36) NOT NULL,
    `enrollment_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `content_rating` INTEGER NOT NULL,
    `trainer_rating` INTEGER NOT NULL,
    `relevance_rating` INTEGER NOT NULL,
    `facility_rating` INTEGER NULL,
    `would_recommend` BOOLEAN NOT NULL,
    `comment` TEXT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `training_feedback_enrollment_id_key`(`enrollment_id`),
    INDEX `training_feedback_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `training_feedback` ADD CONSTRAINT `training_feedback_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `training_enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_feedback` ADD CONSTRAINT `training_feedback_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
