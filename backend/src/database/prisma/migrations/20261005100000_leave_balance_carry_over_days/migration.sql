-- Yearly accrual derived the carry-over by reading last year's remainingDays,
-- and expiry then zeroed that field. So a second accrual run for the same year
-- read zero, recomputed totalDays as entitlement alone, and destroyed the days
-- an employee had carried. POST /leave/balances/accrue put that one call away.
--
-- The carried amount has to be stored, because once expiry has run it cannot
-- be reconstructed from anything. Additive, defaulted, nothing rewritten:
-- existing rows report 0 carried, which is what an un-upgraded row can honestly
-- claim, and the next accrual records the real figure.

SET @add := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'leave_balances'
     AND column_name = 'carry_over_days') = 0,
  'ALTER TABLE `leave_balances` ADD COLUMN `carry_over_days` INT NOT NULL DEFAULT 0',
  'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;
