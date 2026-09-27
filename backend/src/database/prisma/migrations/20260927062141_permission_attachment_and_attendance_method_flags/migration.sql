-- AlterTable
ALTER TABLE `employees` ADD COLUMN `allow_face_recognition` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `allow_fingerprint` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `allow_mobile_gps` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `permission_requests` ADD COLUMN `attachment` VARCHAR(500) NULL;
