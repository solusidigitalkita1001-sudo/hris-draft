-- AlterTable
ALTER TABLE `branch_attendance_policies` MODIFY `attendance_method` ENUM('FINGERPRINT', 'MOBILE_GPS', 'BOTH', 'MANUAL', 'FACE_RECOGNITION', 'FACE_GPS') NOT NULL DEFAULT 'MANUAL';
