-- GAP-27 promised "reminder otomatis" alongside signer ordering and deadlines.
-- The ordering and the deadlines were built; the reminder was not — there was
-- no notification write and no scheduler, so a document sat unsigned past its
-- due date with nobody told.
--
-- A daily sweep needs somewhere to record that it already reminded this signer
-- about this deadline, or it sends the same reminder every morning until the
-- recipient filters the sender. Nullable and defaulted to nothing: an existing
-- signer has been reminded about no deadline, which is true.

SET @add := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'document_signers'
     AND column_name = 'last_reminder_days') = 0,
  'ALTER TABLE `document_signers` ADD COLUMN `last_reminder_days` INT NULL',
  'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;
