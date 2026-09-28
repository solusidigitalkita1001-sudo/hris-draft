CREATE TABLE `payroll_unlock_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `last_used_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `payroll_unlock_sessions_token_hash_key` (`token_hash`),
  INDEX `payroll_unlock_sessions_company_id_user_id_expires_at_idx` (`company_id`, `user_id`, `expires_at`),
  INDEX `payroll_unlock_sessions_employee_id_expires_at_idx` (`employee_id`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payroll_unlock_guards` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `failed_attempts` INTEGER NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `payroll_unlock_guards_company_id_user_id_key` (`company_id`, `user_id`),
  INDEX `payroll_unlock_guards_locked_until_idx` (`locked_until`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `payroll_unlock_sessions`
  ADD CONSTRAINT `payroll_unlock_sessions_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payroll_unlock_sessions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payroll_unlock_sessions_employee_id_fkey`
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payroll_unlock_guards`
  ADD CONSTRAINT `payroll_unlock_guards_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payroll_unlock_guards_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
