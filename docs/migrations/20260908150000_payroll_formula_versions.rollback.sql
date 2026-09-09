-- Manual rollback only after stopping payroll/formula writes and workers.
-- Back up and archive revision history, audits and execution evidence first.
-- Prefer a forward fix after payroll has used a published formula.
-- This rollback does NOT recalculate historical payroll or reverse payments.
DROP TABLE `payroll_formula_calculations`;
DROP TABLE `payroll_formula_audits`;
DROP TABLE `payroll_formula_versions`;
