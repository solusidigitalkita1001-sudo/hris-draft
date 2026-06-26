-- CreateTable
CREATE TABLE `work_calendars` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NULL,
    `department_id` VARCHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `year` INTEGER NOT NULL,
    `work_days` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `work_calendars_company_id_idx`(`company_id`),
    INDEX `work_calendars_year_idx`(`year`),
    UNIQUE INDEX `work_calendars_company_id_branch_id_department_id_year_key`(`company_id`, `branch_id`, `department_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_calendar_days` (
    `id` VARCHAR(36) NOT NULL,
    `calendar_id` VARCHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `day_type` VARCHAR(2) NOT NULL,
    `name` VARCHAR(150) NULL,
    `notes` TEXT NULL,
    `work_start` VARCHAR(5) NULL,
    `work_end` VARCHAR(5) NULL,
    `is_mandatory` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `work_calendar_days_calendar_id_idx`(`calendar_id`),
    INDEX `work_calendar_days_date_idx`(`date`),
    UNIQUE INDEX `work_calendar_days_calendar_id_date_key`(`calendar_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `national_holidays` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `country_code` VARCHAR(2) NOT NULL DEFAULT 'ID',
    `date` DATE NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` VARCHAR(2) NOT NULL,
    `year` INTEGER NOT NULL,
    `source` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `national_holidays_year_idx`(`year`),
    UNIQUE INDEX `national_holidays_company_id_country_code_date_key`(`company_id`, `country_code`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `work_calendars` ADD CONSTRAINT `work_calendars_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_calendar_days` ADD CONSTRAINT `work_calendar_days_calendar_id_fkey` FOREIGN KEY (`calendar_id`) REFERENCES `work_calendars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `national_holidays` ADD CONSTRAINT `national_holidays_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exit_clearances` ADD CONSTRAINT `exit_clearances_pic_id_fkey` FOREIGN KEY (`pic_id`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
