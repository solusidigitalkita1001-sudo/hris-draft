-- Leave balance expiry tracking untuk carry-over automation.
ALTER TABLE `leave_balances` ADD COLUMN `expired_at` DATETIME(3) NULL;
