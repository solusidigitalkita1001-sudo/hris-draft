-- Automatic payroll component codes are shared names scoped to a company.
-- Existing global uniqueness guarantees this composite index can be created.
CREATE UNIQUE INDEX `salary_components_company_id_code_key` ON `salary_components`(`company_id`, `code`);
DROP INDEX `salary_components_code_key` ON `salary_components`;
