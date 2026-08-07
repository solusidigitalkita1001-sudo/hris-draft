-- Audit log tamper-evidence: per-entry HMAC-SHA256 hash chained via prev_hash.
ALTER TABLE `audit_logs` ADD COLUMN `hash` VARCHAR(64) NULL;
ALTER TABLE `audit_logs` ADD COLUMN `prev_hash` VARCHAR(64) NULL;
