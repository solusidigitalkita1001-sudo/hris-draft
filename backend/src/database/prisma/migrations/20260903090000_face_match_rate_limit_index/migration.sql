CREATE INDEX `attendance_face_logs_rate_limit_idx`
  ON `attendance_face_logs` (`company_id`, `employee_id`, `is_face_match`, `created_at`);
