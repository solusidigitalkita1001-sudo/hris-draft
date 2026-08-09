-- Attendance summary review gate: HR konfirmasi absensi sebelum payroll run bisa dieksekusi.
ALTER TABLE `payroll_periods`
  ADD COLUMN `attendance_reviewed_at` DATETIME(3) NULL,
  ADD COLUMN `attendance_reviewed_by` VARCHAR(36) NULL;
