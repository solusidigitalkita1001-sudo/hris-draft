-- Career movements gain an applied marker (checklist §9): future-dated
-- transactions no longer mutate the employee immediately — a scheduler
-- applies them at their effective date. Existing rows were applied at
-- creation, so backfill appliedAt from created_at.

ALTER TABLE `employee_career_transactions`
  ADD COLUMN `applied_at` DATETIME(3) NULL;

UPDATE `employee_career_transactions` SET `applied_at` = `created_at` WHERE `applied_at` IS NULL;
