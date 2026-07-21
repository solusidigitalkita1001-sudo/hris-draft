-- AlterTable
ALTER TABLE `performance_method_versions` ADD COLUMN `approval_workflow_template_id` VARCHAR(36) NULL,
    ADD COLUMN `review_workflow_template_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `performance_method_versions_review_workflow_template_id_idx` ON `performance_method_versions`(`review_workflow_template_id`);

-- CreateIndex
CREATE INDEX `performance_method_versions_approval_workflow_template_id_idx` ON `performance_method_versions`(`approval_workflow_template_id`);

-- AddForeignKey
ALTER TABLE `performance_method_versions` ADD CONSTRAINT `performance_method_versions_review_workflow_template_id_fkey` FOREIGN KEY (`review_workflow_template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_method_versions` ADD CONSTRAINT `performance_method_versions_approval_workflow_template_id_fkey` FOREIGN KEY (`approval_workflow_template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
