-- AlterTable
ALTER TABLE `employees` ADD COLUMN `employee_category` ENUM('OFFICE', 'FACTORY', 'FIELD', 'REMOTE') NOT NULL DEFAULT 'OFFICE',
    ADD COLUMN `shift_formula_id` VARCHAR(36) NULL,
    ADD COLUMN `shift_start_date` DATE NULL;

-- CreateTable
CREATE TABLE `shift_formulas` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `cycle_length` INTEGER NOT NULL,
    `description` TEXT NULL,
    `created_by` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `shift_formulas_company_id_idx`(`company_id`),
    UNIQUE INDEX `shift_formulas_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_formula_days` (
    `id` VARCHAR(36) NOT NULL,
    `shift_formula_id` VARCHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `label` VARCHAR(100) NULL,
    `day_type` VARCHAR(2) NOT NULL,
    `work_start` VARCHAR(5) NULL,
    `work_end` VARCHAR(5) NULL,
    `crosses_midnight` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shift_formula_days_shift_formula_id_idx`(`shift_formula_id`),
    UNIQUE INDEX `shift_formula_days_shift_formula_id_sequence_key`(`shift_formula_id`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `employees_shift_formula_id_idx` ON `employees`(`shift_formula_id`);

-- AddForeignKey
ALTER TABLE `shift_formulas` ADD CONSTRAINT `shift_formulas_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_formula_days` ADD CONSTRAINT `shift_formula_days_shift_formula_id_fkey` FOREIGN KEY (`shift_formula_id`) REFERENCES `shift_formulas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_shift_formula_id_fkey` FOREIGN KEY (`shift_formula_id`) REFERENCES `shift_formulas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
