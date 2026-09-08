-- Stop salary component/payroll mutations and verify a backup before rollback.
-- This query must return zero rows. If codes now exist in multiple companies,
-- prefer a forward fix; never delete or silently rename automatic components.
SELECT `code`, COUNT(*) FROM `salary_components` GROUP BY `code` HAVING COUNT(*) > 1;
-- Creating the global index fails safely if duplicate cross-company codes exist.
CREATE UNIQUE INDEX `salary_components_code_key` ON `salary_components`(`code`);
DROP INDEX `salary_components_company_id_code_key` ON `salary_components`;
