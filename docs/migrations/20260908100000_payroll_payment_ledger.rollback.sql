-- MANUAL rollback plan, not an automatic down migration.
-- Stop payroll mutations and workers; take and verify a backup first.
-- Preserve all payment batches, transactions, operations, logs, and loan snapshots
-- in restricted archival storage. Reconciled payroll/loan states must NOT be
-- reversed here: a database rollback does not reverse payments at the bank.
-- Keep the new application write-disabled until its schema rollback is complete.
-- Restore a reviewed compatible application release; do not re-enable the old
-- direct-disbursement endpoint, which marks payroll paid without reconciliation.
-- Prefer a forward fix when any ledger records have been created.
DROP TABLE `payroll_payment_logs`;
DROP TABLE `payroll_payment_transactions`;
DROP TABLE `payroll_payment_operations`;
DROP TABLE `payroll_payment_batches`;
DROP TABLE `payroll_loan_deduction_snapshots`;
