-- Career movement carries compensation (checklist §9 downstream: salary).
-- When set, applying the movement creates a new EmployeeSalary row effective
-- from the movement's effective date. Additive only.

ALTER TABLE `employee_career_transactions`
  ADD COLUMN `to_base_salary` DECIMAL(15, 2) NULL;
