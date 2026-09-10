-- Attendance corrections must keep what they overwrote (checklist §10:
-- "Simpan before/after correction"). Captured at approval time.

ALTER TABLE `attendance_corrections`
  ADD COLUMN `before_check_in` DATETIME(3) NULL,
  ADD COLUMN `before_check_out` DATETIME(3) NULL,
  ADD COLUMN `before_status` VARCHAR(20) NULL;
