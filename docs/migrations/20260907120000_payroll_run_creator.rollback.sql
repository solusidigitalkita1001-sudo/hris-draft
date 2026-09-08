-- Deploy the previous application version first. Export creator attribution
-- before rollback: dropping this additive column discards the new attribution.
ALTER TABLE `payroll_runs` DROP COLUMN `created_by`;
