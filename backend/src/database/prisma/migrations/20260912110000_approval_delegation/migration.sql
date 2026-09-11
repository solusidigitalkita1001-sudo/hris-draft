-- Out-of-office approval delegation (checklist §6). While a delegation is
-- active and within its date window, the delegate may act on any workflow
-- step the delegator could act on.

CREATE TABLE `approval_delegations` (
  `id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `delegator_id` VARCHAR(36) NOT NULL,
  `delegate_id` VARCHAR(36) NOT NULL,
  `start_date` DATETIME(3) NOT NULL,
  `end_date` DATETIME(3) NOT NULL,
  `reason` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `approval_delegations_company_id_idx`(`company_id`),
  INDEX `approval_delegations_delegate_id_is_active_idx`(`delegate_id`, `is_active`),
  INDEX `approval_delegations_delegator_id_is_active_idx`(`delegator_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `approval_delegations` ADD CONSTRAINT `approval_delegations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `approval_delegations` ADD CONSTRAINT `approval_delegations_delegator_id_fkey` FOREIGN KEY (`delegator_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `approval_delegations` ADD CONSTRAINT `approval_delegations_delegate_id_fkey` FOREIGN KEY (`delegate_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
