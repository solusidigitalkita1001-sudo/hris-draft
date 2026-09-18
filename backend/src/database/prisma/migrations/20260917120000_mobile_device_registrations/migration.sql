CREATE TABLE `mobile_device_registrations` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `installation_id` VARCHAR(200) NOT NULL,
  `platform` ENUM('ANDROID', 'IOS') NOT NULL,
  `provider` ENUM('FCM', 'APNS') NOT NULL,
  `token` TEXT NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `app_version` VARCHAR(50) NULL,
  `device_model` VARCHAR(100) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `mobile_device_registrations_token_hash_key`(`token_hash`),
  UNIQUE INDEX `mobile_device_registrations_user_id_installation_id_key`(`user_id`, `installation_id`),
  INDEX `mobile_device_registrations_company_id_user_id_is_active_idx`(`company_id`, `user_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `mobile_device_registrations`
  ADD CONSTRAINT `mobile_device_registrations_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mobile_device_registrations`
  ADD CONSTRAINT `mobile_device_registrations_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
