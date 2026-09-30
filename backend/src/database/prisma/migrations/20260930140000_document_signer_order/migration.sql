-- CreateTable
CREATE TABLE `document_signers` (
    `id` VARCHAR(36) NOT NULL,
    `document_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,
    `due_at` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'SIGNED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `signed_at` DATETIME(3) NULL,
    `declined_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `document_signers_document_id_user_id_key`(`document_id`, `user_id`),
    INDEX `document_signers_document_id_order_idx`(`document_id`, `order`),
    INDEX `document_signers_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document_signers` ADD CONSTRAINT `document_signers_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_signers` ADD CONSTRAINT `document_signers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
