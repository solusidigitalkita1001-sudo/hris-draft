-- Reconcile schema drift (production hotfix): many tables/columns were added to
-- schema.prisma but never migrated, so the generated Prisma client SELECTs
-- columns/tables that do not exist in the database -> "Unknown column/table" ->
-- 500 on companies, departments, assets, leave, benefits, recruitment, EWA,
-- daily-activities, audit-logs, notifications, etc. for ALL roles.
--
-- Purely additive (no DROP). CREATE TABLE are IF NOT EXISTS so re-running over a
-- db-push'd database is safe. The 9 NOT NULL company_id columns are added
-- NULLABLE, backfilled from their parent (employee/asset/department — all of
-- which carry a non-null company_id), then tightened to NOT NULL at the end.
-- AlterTable
ALTER TABLE `asset_assignments` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `attendances` MODIFY `method` ENUM('FINGERPRINT', 'MOBILE_GPS', 'MANUAL', 'FACE_RECOGNITION') NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE `companies` ADD COLUMN `operational_status` ENUM('ACTIVE', 'TRIAL', 'SUSPENDED', 'INACTIVE', 'PENDING_ONBOARDING') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `employee_attachments` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employee_educations` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employee_emergency_contacts` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employee_experiences` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employee_families` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employee_skills` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employee_trainings` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `reference_photo_updated_at` DATETIME(3) NULL,
    ADD COLUMN `reference_photo_url` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `sub_departments` ADD COLUMN `company_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS `tax_brackets` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NULL,
    `year` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `upper_bound` DECIMAL(18, 2) NOT NULL,
    `rate_percent` DECIMAL(5, 4) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tax_brackets_year_idx`(`year`),
    UNIQUE INDEX `tax_brackets_company_id_year_level_key`(`company_id`, `year`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ptkp_tables` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NULL,
    `year` INTEGER NOT NULL,
    `marital_status` VARCHAR(10) NOT NULL,
    `dependents` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ptkp_tables_year_idx`(`year`),
    UNIQUE INDEX `ptkp_tables_company_id_year_marital_status_dependents_key`(`company_id`, `year`, `marital_status`, `dependents`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `bpjs_references` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NULL,
    `year` INTEGER NOT NULL,
    `jkk_risk_class` ENUM('I', 'II', 'III', 'IV', 'V') NOT NULL DEFAULT 'I',
    `jkk_rate_percent` DECIMAL(5, 4) NOT NULL,
    `jkm_rate_percent` DECIMAL(5, 4) NOT NULL,
    `jht_employer_percent` DECIMAL(5, 4) NOT NULL,
    `jht_employee_percent` DECIMAL(5, 4) NOT NULL,
    `jp_employer_percent` DECIMAL(5, 4) NOT NULL,
    `jp_employee_percent` DECIMAL(5, 4) NOT NULL,
    `jp_wage_cap` DECIMAL(15, 2) NOT NULL,
    `jkn_employer_percent` DECIMAL(5, 4) NOT NULL,
    `jkn_employee_percent` DECIMAL(5, 4) NOT NULL,
    `jkn_wage_cap` DECIMAL(15, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bpjs_references_year_idx`(`year`),
    UNIQUE INDEX `bpjs_references_company_id_year_jkk_risk_class_key`(`company_id`, `year`, `jkk_risk_class`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `employee_bank_accounts` (
    `id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `bank_code` ENUM('BCA', 'MANDIRI', 'BNI', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `bank_name` VARCHAR(255) NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `account_holder` VARCHAR(255) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_bank_accounts_employee_id_idx`(`employee_id`),
    INDEX `employee_bank_accounts_company_id_idx`(`company_id`),
    INDEX `employee_bank_accounts_bank_code_idx`(`bank_code`),
    UNIQUE INDEX `employee_bank_accounts_employee_id_bank_code_key`(`employee_id`, `bank_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `claim_category_limits` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `category` ENUM('TRANSPORTATION', 'HOTEL', 'MEAL', 'ENTERTAINMENT', 'OPERATIONAL') NOT NULL,
    `period_type` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONCE') NOT NULL DEFAULT 'MONTHLY',
    `limit_amount` DECIMAL(15, 2) NOT NULL,
    `violation_action` ENUM('WARN', 'BLOCK') NOT NULL DEFAULT 'WARN',
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `valid_from` DATETIME(3) NULL,
    `valid_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `claim_category_limits_company_id_idx`(`company_id`),
    INDEX `claim_category_limits_is_active_idx`(`is_active`),
    UNIQUE INDEX `claim_category_limits_company_id_category_period_type_key`(`company_id`, `category`, `period_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `earned_wage_accesses` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `request_code` VARCHAR(50) NOT NULL,
    `payroll_period_id` VARCHAR(36) NULL,
    `payroll_run_id` VARCHAR(36) NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `earned_gross_reference` DECIMAL(15, 2) NOT NULL,
    `earned_gross_at_request` DECIMAL(15, 2) NOT NULL,
    `max_allowed_percent` INTEGER NOT NULL DEFAULT 50,
    `max_allowed_at_request` DECIMAL(15, 2) NOT NULL,
    `total_approved_same_period` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `amount_requested` DECIMAL(15, 2) NOT NULL,
    `admin_fee` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `amount_paid_out` DECIMAL(15, 2) NULL,
    `amount_deducted_payroll` DECIMAL(15, 2) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'DEDUCTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `approver_id` VARCHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `approver_notes` TEXT NULL,
    `finance_disburser_id` VARCHAR(36) NULL,
    `paid_out_at` DATETIME(3) NULL,
    `disbursement_reference` VARCHAR(100) NULL,
    `deducted_at` DATETIME(3) NULL,
    `reject_reason` TEXT NULL,
    `cancelled_by` VARCHAR(36) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `earned_wage_accesses_request_code_key`(`request_code`),
    INDEX `earned_wage_accesses_company_id_status_idx`(`company_id`, `status`),
    INDEX `earned_wage_accesses_employee_id_status_idx`(`employee_id`, `status`),
    INDEX `earned_wage_accesses_payroll_run_id_idx`(`payroll_run_id`),
    INDEX `earned_wage_accesses_payroll_period_id_idx`(`payroll_period_id`),
    INDEX `earned_wage_accesses_period_start_period_end_idx`(`period_start`, `period_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `daily_activities` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `employee_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NULL,
    `activity_date` DATE NOT NULL,
    `activity_type` ENUM('WORK', 'SITE_VISIT', 'SITE_INSPECTION', 'MEETING', 'OTHER') NOT NULL DEFAULT 'WORK',
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `photo_url` VARCHAR(500) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `geo_accuracy_meters` DECIMAL(8, 2) NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `is_outside_radius` BOOLEAN NOT NULL DEFAULT false,
    `distance_from_branch_meters` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_activities_company_id_activity_date_idx`(`company_id`, `activity_date`),
    INDEX `daily_activities_employee_id_activity_date_idx`(`employee_id`, `activity_date`),
    INDEX `daily_activities_activity_type_idx`(`activity_type`),
    INDEX `daily_activities_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `task_assignments` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `creator_id` VARCHAR(36) NOT NULL,
    `assignee_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    `due_date` DATE NULL,
    `completed_at` DATETIME(3) NULL,
    `feedback_star` INTEGER NULL,
    `feedback_note` TEXT NULL,
    `progress_percent` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_assignments_company_id_status_idx`(`company_id`, `status`),
    INDEX `task_assignments_assignee_id_status_idx`(`assignee_id`, `status`),
    INDEX `task_assignments_due_date_idx`(`due_date`),
    INDEX `task_assignments_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `esignature_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `document_signature_id` VARCHAR(36) NOT NULL,
    `document_id` VARCHAR(36) NOT NULL,
    `signer_user_id` VARCHAR(36) NOT NULL,
    `provider` ENUM('INTERNAL', 'PRIVY_ID', 'DIGISIGN', 'PERURI', 'OTHER') NOT NULL DEFAULT 'INTERNAL',
    `status` ENUM('DRAFT', 'REQUESTED', 'SIGNED', 'VERIFIED', 'REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `verificationLevel` ENUM('CERTIFIED', 'AUDIT_TRAIL', 'BASIC') NOT NULL DEFAULT 'BASIC',
    `provider_ref` VARCHAR(100) NULL,
    `signerNik` VARCHAR(32) NULL,
    `signerEmail` VARCHAR(255) NULL,
    `signerPhone` VARCHAR(20) NULL,
    `request_sent_at` DATETIME(3) NULL,
    `signed_at` DATETIME(3) NULL,
    `verified_at` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NULL,
    `callback_payload_json` TEXT NULL,
    `document_hash_sha256` VARCHAR(64) NULL,
    `signingUrl` VARCHAR(700) NULL,
    `costAmountRupiah` DECIMAL(15, 2) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `esignature_transactions_company_id_status_idx`(`company_id`, `status`),
    INDEX `esignature_transactions_provider_status_idx`(`provider`, `status`),
    INDEX `esignature_transactions_document_id_idx`(`document_id`),
    UNIQUE INDEX `esignature_transactions_provider_provider_ref_key`(`provider`, `provider_ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `asset_patrol_logs` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `asset_id` VARCHAR(36) NOT NULL,
    `patrol_by_id` VARCHAR(36) NOT NULL,
    `barcode_scan_raw` VARCHAR(255) NULL,
    `expected_asset_code` VARCHAR(50) NULL,
    `is_barcode_matched` BOOLEAN NOT NULL DEFAULT true,
    `photo_condition_url` VARCHAR(500) NULL,
    `condition_rating` ENUM('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'MISSING') NOT NULL DEFAULT 'GOOD',
    `note` TEXT NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `geo_accuracy_meters` DECIMAL(8, 2) NULL,
    `patrol_route_id` VARCHAR(36) NULL,
    `patrol_sequence_no` INTEGER NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `asset_patrol_logs_company_id_occurred_at_idx`(`company_id`, `occurred_at`),
    INDEX `asset_patrol_logs_asset_id_occurred_at_idx`(`asset_id`, `occurred_at`),
    INDEX `asset_patrol_logs_patrol_by_id_occurred_at_idx`(`patrol_by_id`, `occurred_at`),
    INDEX `asset_patrol_logs_condition_rating_idx`(`condition_rating`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `audienceType` ENUM('ALL', 'COMPANY_WIDE', 'DEPARTMENT_ONLY', 'BRANCH_ONLY', 'POSITION_ONLY', 'EMPLOYEE_SPECIFIC') NOT NULL DEFAULT 'COMPANY_WIDE',
    `departmentIds` TEXT NULL,
    `branchIds` TEXT NULL,
    `positionIds` TEXT NULL,
    `employeeIds` TEXT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `cover_image_url` VARCHAR(500) NULL,
    `priority` ENUM('PINNED', 'NORMAL', 'HIDDEN') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `publish_from` DATETIME(3) NULL,
    `publish_until` DATETIME(3) NULL,
    `pinned_until` DATETIME(3) NULL,
    `allowComment` BOOLEAN NOT NULL DEFAULT false,
    `totalViews` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `announcements_company_id_status_idx`(`company_id`, `status`),
    INDEX `announcements_status_publish_from_idx`(`status`, `publish_from`),
    INDEX `announcements_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `announcement_reads` (
    `id` VARCHAR(36) NOT NULL,
    `announcement_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `announcement_reads_user_id_read_at_idx`(`user_id`, `read_at`),
    UNIQUE INDEX `announcement_reads_announcement_id_user_id_key`(`announcement_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `surveys` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `created_by_id` VARCHAR(36) NOT NULL,
    `type` ENUM('POLL', 'SURVEY') NOT NULL DEFAULT 'SURVEY',
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `allowMultipleSubmission` BOOLEAN NOT NULL DEFAULT false,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `targetAudienceIds` TEXT NULL,
    `max_responses` INTEGER NULL,
    `totalResponses` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `surveys_company_id_status_idx`(`company_id`, `status`),
    INDEX `surveys_status_start_date_end_date_idx`(`status`, `start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `survey_questions` (
    `id` VARCHAR(36) NOT NULL,
    `survey_id` VARCHAR(36) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `question_text` TEXT NOT NULL,
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'RATING_1_5') NOT NULL DEFAULT 'SINGLE_CHOICE',
    `options_json` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `min_select` INTEGER NULL,
    `max_select` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `survey_questions_survey_id_position_idx`(`survey_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `survey_responses` (
    `id` VARCHAR(36) NOT NULL,
    `survey_id` VARCHAR(36) NOT NULL,
    `respondent_id` VARCHAR(36) NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `survey_responses_survey_id_idx`(`survey_id`),
    INDEX `survey_responses_respondent_id_survey_id_idx`(`respondent_id`, `survey_id`),
    UNIQUE INDEX `survey_responses_respondent_id_survey_id_key`(`respondent_id`, `survey_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `survey_answers` (
    `id` VARCHAR(36) NOT NULL,
    `response_id` VARCHAR(36) NOT NULL,
    `question_id` VARCHAR(36) NOT NULL,
    `textValue` TEXT NULL,
    `numberValue` DECIMAL(10, 2) NULL,
    `selected_json` TEXT NULL,

    INDEX `survey_answers_question_id_idx`(`question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `asset_assignments_company_id_idx` ON `asset_assignments`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_attachments_company_id_idx` ON `employee_attachments`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_educations_company_id_idx` ON `employee_educations`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_emergency_contacts_company_id_idx` ON `employee_emergency_contacts`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_experiences_company_id_idx` ON `employee_experiences`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_families_company_id_idx` ON `employee_families`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_skills_company_id_idx` ON `employee_skills`(`company_id`);

-- CreateIndex
CREATE INDEX `employee_trainings_company_id_idx` ON `employee_trainings`(`company_id`);

-- CreateIndex
CREATE INDEX `sub_departments_company_id_idx` ON `sub_departments`(`company_id`);

-- AddForeignKey
ALTER TABLE `sub_departments` ADD CONSTRAINT `sub_departments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tax_brackets` ADD CONSTRAINT `tax_brackets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ptkp_tables` ADD CONSTRAINT `ptkp_tables_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bpjs_references` ADD CONSTRAINT `bpjs_references_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_bank_accounts` ADD CONSTRAINT `employee_bank_accounts_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_bank_accounts` ADD CONSTRAINT `employee_bank_accounts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_families` ADD CONSTRAINT `employee_families_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_educations` ADD CONSTRAINT `employee_educations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_emergency_contacts` ADD CONSTRAINT `employee_emergency_contacts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_trainings` ADD CONSTRAINT `employee_trainings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_skills` ADD CONSTRAINT `employee_skills_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_experiences` ADD CONSTRAINT `employee_experiences_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_attachments` ADD CONSTRAINT `employee_attachments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_assignments` ADD CONSTRAINT `asset_assignments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `claim_category_limits` ADD CONSTRAINT `claim_category_limits_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `earned_wage_accesses` ADD CONSTRAINT `earned_wage_accesses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `earned_wage_accesses` ADD CONSTRAINT `earned_wage_accesses_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `earned_wage_accesses` ADD CONSTRAINT `earned_wage_accesses_payroll_period_id_fkey` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `earned_wage_accesses` ADD CONSTRAINT `earned_wage_accesses_payroll_run_id_fkey` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_activities` ADD CONSTRAINT `daily_activities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_activities` ADD CONSTRAINT `daily_activities_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_activities` ADD CONSTRAINT `daily_activities_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_creator_id_fkey` FOREIGN KEY (`creator_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignments` ADD CONSTRAINT `task_assignments_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esignature_transactions` ADD CONSTRAINT `esignature_transactions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esignature_transactions` ADD CONSTRAINT `esignature_transactions_document_signature_id_fkey` FOREIGN KEY (`document_signature_id`) REFERENCES `document_signatures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esignature_transactions` ADD CONSTRAINT `esignature_transactions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esignature_transactions` ADD CONSTRAINT `esignature_transactions_signer_user_id_fkey` FOREIGN KEY (`signer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_patrol_logs` ADD CONSTRAINT `asset_patrol_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_patrol_logs` ADD CONSTRAINT `asset_patrol_logs_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_patrol_logs` ADD CONSTRAINT `asset_patrol_logs_patrol_by_id_fkey` FOREIGN KEY (`patrol_by_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_reads` ADD CONSTRAINT `announcement_reads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `surveys` ADD CONSTRAINT `surveys_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `surveys` ADD CONSTRAINT `surveys_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_questions` ADD CONSTRAINT `survey_questions_survey_id_fkey` FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_responses` ADD CONSTRAINT `survey_responses_survey_id_fkey` FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_responses` ADD CONSTRAINT `survey_responses_respondent_id_fkey` FOREIGN KEY (`respondent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_answers` ADD CONSTRAINT `survey_answers_response_id_fkey` FOREIGN KEY (`response_id`) REFERENCES `survey_responses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_answers` ADD CONSTRAINT `survey_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `survey_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Backfill company_id on pre-existing sub-tables from their parent ──────────
UPDATE `employee_attachments` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `employee_educations` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `employee_emergency_contacts` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `employee_experiences` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `employee_families` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `employee_skills` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `employee_trainings` t JOIN `employees` e ON t.`employee_id` = e.`id` SET t.`company_id` = e.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `asset_assignments` t JOIN `assets` a ON t.`asset_id` = a.`id` SET t.`company_id` = a.`company_id` WHERE t.`company_id` IS NULL;
UPDATE `sub_departments` t JOIN `departments` d ON t.`department_id` = d.`id` SET t.`company_id` = d.`company_id` WHERE t.`company_id` IS NULL;

-- ── Tighten to NOT NULL once backfilled (matches schema.prisma) ──────────────
ALTER TABLE `employee_attachments` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `employee_educations` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `employee_emergency_contacts` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `employee_experiences` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `employee_families` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `employee_skills` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `employee_trainings` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `asset_assignments` MODIFY `company_id` VARCHAR(36) NOT NULL;
ALTER TABLE `sub_departments` MODIFY `company_id` VARCHAR(36) NOT NULL;
