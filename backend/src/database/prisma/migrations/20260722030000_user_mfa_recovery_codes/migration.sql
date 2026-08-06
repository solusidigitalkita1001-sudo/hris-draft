-- Task 1.1 (SEC-006): store hashed one-time MFA recovery codes (JSON array).
ALTER TABLE `users` ADD COLUMN `two_factor_recovery_codes` TEXT NULL;
