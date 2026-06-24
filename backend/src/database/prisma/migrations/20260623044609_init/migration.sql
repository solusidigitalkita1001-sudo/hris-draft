-- AlterTable
ALTER TABLE `employees` ADD COLUMN `bank_account` VARCHAR(50) NULL,
    ADD COLUMN `bank_account_holder` VARCHAR(255) NULL,
    ADD COLUMN `bank_name` VARCHAR(100) NULL,
    ADD COLUMN `bpjs_kesehatan` VARCHAR(50) NULL,
    ADD COLUMN `bpjs_ketenagakerjaan` VARCHAR(50) NULL,
    ADD COLUMN `tax_id` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `salary_components` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` ENUM('ALLOWANCE', 'DEDUCTION') NOT NULL DEFAULT 'ALLOWANCE',
    `calculation_method` VARCHAR(50) NOT NULL DEFAULT 'FIXED',
    `amount` DECIMAL(15, 2) NULL,
    `rate_percent` DECIMAL(5, 2) NULL,
    `is_taxable` BOOLEAN NOT NULL DEFAULT true,
    `is_prorated` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `salary_components_code_key`(`code`),
    INDEX `salary_components_company_id_idx`(`company_id`),
    INDEX `salary_components_code_idx`(`code`),
    INDEX `salary_components_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_salaries` (
    `id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `base_salary` DECIMAL(15, 2) NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'IDR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `employee_salaries_employee_id_idx`(`employee_id`),
    INDEX `employee_salaries_company_id_idx`(`company_id`),
    INDEX `employee_salaries_effective_date_idx`(`effective_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_salary_components` (
    `id` VARCHAR(36) NOT NULL,
    `employee_salary_id` VARCHAR(36) NOT NULL,
    `salary_component_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employee_salary_components_employee_salary_id_salary_compone_key`(`employee_salary_id`, `salary_component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_periods` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `frequency` ENUM('MONTHLY', 'BIWEEKLY', 'WEEKLY') NOT NULL DEFAULT 'MONTHLY',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `pay_date` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `payroll_periods_code_key`(`code`),
    INDEX `payroll_periods_company_id_idx`(`company_id`),
    INDEX `payroll_periods_code_idx`(`code`),
    INDEX `payroll_periods_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_runs` (
    `id` VARCHAR(36) NOT NULL,
    `period_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `run_number` INTEGER NOT NULL,
    `total_employees` INTEGER NOT NULL DEFAULT 0,
    `total_earnings` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_deductions` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_net_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PROCESSING', 'COMPLETED', 'APPROVED', 'DISBURSED') NOT NULL DEFAULT 'DRAFT',
    `approved_by` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `disbursed_by` VARCHAR(36) NULL,
    `disbursed_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `payroll_runs_period_id_idx`(`period_id`),
    INDEX `payroll_runs_company_id_idx`(`company_id`),
    INDEX `payroll_runs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` VARCHAR(36) NOT NULL,
    `payroll_run_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_salary_id` VARCHAR(36) NULL,
    `base_salary` DECIMAL(15, 2) NOT NULL,
    `total_earnings` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_deductions` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `net_pay` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `work_days` INTEGER NOT NULL DEFAULT 0,
    `present_days` INTEGER NOT NULL DEFAULT 0,
    `leave_days` INTEGER NOT NULL DEFAULT 0,
    `absent_days` INTEGER NOT NULL DEFAULT 0,
    `overtime_hours` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'FINAL') NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payslips_payroll_run_id_idx`(`payroll_run_id`),
    INDEX `payslips_employee_id_idx`(`employee_id`),
    INDEX `payslips_company_id_idx`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_components` (
    `id` VARCHAR(36) NOT NULL,
    `payslip_id` VARCHAR(36) NOT NULL,
    `salary_component_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('ALLOWANCE', 'DEDUCTION') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `is_taxable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payslip_components_payslip_id_idx`(`payslip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benefit_plans` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `provider` VARCHAR(255) NULL,
    `is_taxable` BOOLEAN NOT NULL DEFAULT false,
    `employee_contribution` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `employer_contribution` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `max_amount` DECIMAL(15, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `effective_date` DATETIME(3) NULL,
    `expiry_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `benefit_plans_code_key`(`code`),
    INDEX `benefit_plans_company_id_idx`(`company_id`),
    INDEX `benefit_plans_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benefit_enrollments` (
    `id` VARCHAR(36) NOT NULL,
    `benefit_plan_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `enrollment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effective_date` DATETIME(3) NOT NULL,
    `expiry_date` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `coverage_details` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `benefit_enrollments_benefit_plan_id_idx`(`benefit_plan_id`),
    INDEX `benefit_enrollments_employee_id_idx`(`employee_id`),
    INDEX `benefit_enrollments_company_id_idx`(`company_id`),
    INDEX `benefit_enrollments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benefit_deductions` (
    `id` VARCHAR(36) NOT NULL,
    `payslip_id` VARCHAR(36) NOT NULL,
    `benefit_enrollment_id` VARCHAR(36) NOT NULL,
    `employee_amount` DECIMAL(15, 2) NOT NULL,
    `employer_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `benefit_deductions_payslip_id_idx`(`payslip_id`),
    INDEX `benefit_deductions_benefit_enrollment_id_idx`(`benefit_enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `salary_components` ADD CONSTRAINT `salary_components_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salaries` ADD CONSTRAINT `employee_salaries_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salaries` ADD CONSTRAINT `employee_salaries_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_components` ADD CONSTRAINT `employee_salary_components_employee_salary_id_fkey` FOREIGN KEY (`employee_salary_id`) REFERENCES `employee_salaries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_components` ADD CONSTRAINT `employee_salary_components_salary_component_id_fkey` FOREIGN KEY (`salary_component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_periods` ADD CONSTRAINT `payroll_periods_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `payroll_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_runs` ADD CONSTRAINT `payroll_runs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_payroll_run_id_fkey` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employee_salary_id_fkey` FOREIGN KEY (`employee_salary_id`) REFERENCES `employee_salaries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_components` ADD CONSTRAINT `payslip_components_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_components` ADD CONSTRAINT `payslip_components_salary_component_id_fkey` FOREIGN KEY (`salary_component_id`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benefit_plans` ADD CONSTRAINT `benefit_plans_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benefit_enrollments` ADD CONSTRAINT `benefit_enrollments_benefit_plan_id_fkey` FOREIGN KEY (`benefit_plan_id`) REFERENCES `benefit_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benefit_enrollments` ADD CONSTRAINT `benefit_enrollments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benefit_enrollments` ADD CONSTRAINT `benefit_enrollments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benefit_deductions` ADD CONSTRAINT `benefit_deductions_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benefit_deductions` ADD CONSTRAINT `benefit_deductions_benefit_enrollment_id_fkey` FOREIGN KEY (`benefit_enrollment_id`) REFERENCES `benefit_enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
