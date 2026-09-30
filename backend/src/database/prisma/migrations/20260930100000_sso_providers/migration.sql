-- CreateTable
CREATE TABLE `sso_providers` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `issuer` VARCHAR(300) NOT NULL,
    `client_id` VARCHAR(300) NOT NULL,
    `client_secret_cipher` TEXT NOT NULL,
    `allowed_domains` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `auto_provision` BOOLEAN NOT NULL DEFAULT false,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `sso_providers_company_id_idx`(`company_id`),
    INDEX `sso_providers_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sso_login_attempts` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `nonce` VARCHAR(100) NOT NULL,
    `code_verifier` VARCHAR(200) NOT NULL,
    `redirect_uri` VARCHAR(300) NOT NULL,
    `return_to` VARCHAR(300) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `ip_address` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sso_login_attempts_state_key`(`state`),
    INDEX `sso_login_attempts_company_id_idx`(`company_id`),
    INDEX `sso_login_attempts_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sso_providers` ADD CONSTRAINT `sso_providers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sso_login_attempts` ADD CONSTRAINT `sso_login_attempts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sso_login_attempts` ADD CONSTRAINT `sso_login_attempts_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `sso_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
