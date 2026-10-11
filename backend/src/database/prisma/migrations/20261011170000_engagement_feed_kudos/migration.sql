-- Engagement (GAP-51): feed perusahaan + kudos antar karyawan.

-- CreateTable
CREATE TABLE `feed_posts` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `author_employee_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `feed_posts_company_id_created_at_idx`(`company_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kudos` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `from_employee_id` VARCHAR(36) NOT NULL,
    `to_employee_id` VARCHAR(36) NOT NULL,
    `badge` VARCHAR(50) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kudos_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `kudos_to_employee_id_idx`(`to_employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `feed_posts` ADD CONSTRAINT `feed_posts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feed_posts` ADD CONSTRAINT `feed_posts_author_employee_id_fkey` FOREIGN KEY (`author_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kudos` ADD CONSTRAINT `kudos_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kudos` ADD CONSTRAINT `kudos_from_employee_id_fkey` FOREIGN KEY (`from_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kudos` ADD CONSTRAINT `kudos_to_employee_id_fkey` FOREIGN KEY (`to_employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
