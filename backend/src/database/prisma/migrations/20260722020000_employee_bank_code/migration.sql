-- Task 1.11 (VAL-006): store the bank so account-number length can be validated.
ALTER TABLE `employees` ADD COLUMN `bank_code` VARCHAR(20) NULL AFTER `bank_name`;
