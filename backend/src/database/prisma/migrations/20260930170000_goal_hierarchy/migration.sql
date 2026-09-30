-- AlterTable
ALTER TABLE `goals` ADD COLUMN `parent_goal_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `goals_parent_goal_id_idx` ON `goals`(`parent_goal_id`);

-- AddForeignKey
ALTER TABLE `goals` ADD CONSTRAINT `goals_parent_goal_id_fkey` FOREIGN KEY (`parent_goal_id`) REFERENCES `goals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
