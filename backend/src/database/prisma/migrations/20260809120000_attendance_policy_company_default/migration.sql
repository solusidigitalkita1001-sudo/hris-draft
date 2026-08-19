-- Company-level default attendance policy: branchId nullable, compound unique (company+branch).
-- Row dengan branchId=NULL = kebijakan default perusahaan (fallback jika branch belum punya policy).

-- STEP 1: Buat non-unique index cadangan di kolom branch_id DULU, supaya FOREIGN KEY
-- `branch_attendance_policies_branch_id_fkey` masih punya index lookup setalah
-- unique index `branch_attendance_policies_branch_id_key` di-drop.
-- (MySQL InnoDB rule: setiap kolom FK constraint WAJIB punya index.)
CREATE INDEX `branch_attendance_policies_branch_id_idx`
    ON `branch_attendance_policies` (`branch_id`);

-- STEP 2: Sekarang aman drop UNIQUE index per-branch (index tidak lagi dipakai FK
-- karena index `branch_attendance_policies_branch_id_idx` di STEP 1 sudah menggantikan).
ALTER TABLE `branch_attendance_policies`
    DROP INDEX `branch_attendance_policies_branch_id_key`;

-- STEP 3: Ubah kolom branch_id jadi NULLABLE (NULL = default company-level policy).
ALTER TABLE `branch_attendance_policies`
    MODIFY COLUMN `branch_id` VARCHAR(36) NULL;

-- STEP 4: Tambah compound unique (company_id, branch_id) supaya:
--   - 1 branch dalam 1 company = maks 1 policy aktif (branch_id NOT NULL)
--   - 1 company = maks 1 row default (branch_id IS NULL) ditenagai oleh MySQL unique NULL-tolerant.
ALTER TABLE `branch_attendance_policies`
    ADD UNIQUE INDEX `branch_attendance_policies_company_id_branch_id_key` (`company_id`, `branch_id`);

