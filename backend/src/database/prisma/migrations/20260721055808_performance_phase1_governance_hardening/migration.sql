-- AlterTable
ALTER TABLE `performance_grade_rules` ADD COLUMN `recommendation_rules` JSON NULL;

-- AlterTable
ALTER TABLE `performance_method_versions` ADD COLUMN `weight_mode` ENUM('STRICT_100', 'FLEXIBLE') NOT NULL DEFAULT 'STRICT_100';
