-- HR helpdesk (GAP-50): tiket permintaan karyawan ke HR + komentar.

-- CreateTable
CREATE TABLE `hr_tickets` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    `assignee_user_id` VARCHAR(36) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `hr_tickets_company_id_status_idx`(`company_id`, `status`),
    INDEX `hr_tickets_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hr_ticket_comments` (
    `id` VARCHAR(36) NOT NULL,
    `ticket_id` VARCHAR(36) NOT NULL,
    `author_user_id` VARCHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hr_ticket_comments_ticket_id_idx`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `hr_tickets` ADD CONSTRAINT `hr_tickets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_tickets` ADD CONSTRAINT `hr_tickets_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_ticket_comments` ADD CONSTRAINT `hr_ticket_comments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `hr_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
