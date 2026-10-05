-- Fase 0 untuk GAP-41/42/14: satu periode hanya bisa punya satu payroll run,
-- karena aturannya tidak pernah membedakan jenis run. Akibatnya THR tidak bisa
-- dibayarkan tanpa membatalkan run gaji bulanan, pesangon tidak punya tempat,
-- dan nominal salah di periode yang sudah disburse hanya bisa diperbaiki
-- dengan membuka ulang run lama.
--
-- Kolomnya DEFAULT 'REGULAR' dan tabelnya sudah berisi: setiap run yang ada
-- memang run gaji bulanan, jadi nilai itu benar secara historis, bukan
-- sekadar nilai pengisi. Tidak ada baris yang ditulis ulang.
--
-- Index (company_id, period_id, run_type) melayani guard satu-run-per-jenis
-- yang menggantikan guard satu-run-per-periode.

SET @col := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'payroll_runs'
     AND column_name = 'run_type') = 0,
  'ALTER TABLE `payroll_runs`
     ADD COLUMN `run_type` ENUM(''REGULAR'',''THR'',''SEVERANCE'',''CORRECTION'')
     NOT NULL DEFAULT ''REGULAR''',
  'DO 0');
PREPARE stmt FROM @col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'payroll_runs'
     AND index_name = 'payroll_runs_company_id_period_id_run_type_idx') = 0,
  'CREATE INDEX `payroll_runs_company_id_period_id_run_type_idx`
     ON `payroll_runs`(`company_id`, `period_id`, `run_type`)',
  'DO 0');
PREPARE stmt FROM @idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;
