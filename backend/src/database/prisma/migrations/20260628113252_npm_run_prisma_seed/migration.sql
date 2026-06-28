-- AlterTable
ALTER TABLE `document_categories` MODIFY `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE';
