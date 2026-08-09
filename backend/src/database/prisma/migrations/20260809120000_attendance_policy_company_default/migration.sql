-- Company-level default attendance policy: branchId nullable, compound unique (company+branch).
-- Row dengan branchId=NULL = kebijakan default perusahaan (fallback jika branch belum punya policy).
ALTER TABLE `branch_attendance_policies`
  DROP INDEX `branch_attendance_policies_branch_id_key`,
  MODIFY COLUMN `branch_id` VARCHAR(36) NULL,
  ADD UNIQUE INDEX `branch_attendance_policies_company_id_branch_id_key` (`company_id`, `branch_id`);
