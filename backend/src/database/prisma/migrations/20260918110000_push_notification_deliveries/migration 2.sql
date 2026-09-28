CREATE TABLE `push_notification_deliveries` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `notification_id` VARCHAR(36) NOT NULL,
  `registration_id` VARCHAR(36) NOT NULL,
  `provider` ENUM('FCM', 'APNS') NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'INVALID_TOKEN', 'FAILED', 'BLOCKED_CONFIG') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `provider_message_id` VARCHAR(500) NULL,
  `last_error` VARCHAR(500) NULL,
  `delivered_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `push_notification_deliveries_notification_id_registration_id_key` (`notification_id`, `registration_id`),
  INDEX `push_notification_deliveries_status_next_attempt_at_idx` (`status`, `next_attempt_at`),
  INDEX `push_notification_deliveries_company_id_user_id_created_at_idx` (`company_id`, `user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `push_notification_deliveries`
  ADD CONSTRAINT `push_notification_deliveries_company_id_fkey`
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `push_notification_deliveries_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `push_notification_deliveries_notification_id_fkey`
  FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `push_notification_deliveries_registration_id_fkey`
  FOREIGN KEY (`registration_id`) REFERENCES `mobile_device_registrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
