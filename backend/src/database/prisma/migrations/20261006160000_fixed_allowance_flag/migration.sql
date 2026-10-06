-- Tunjangan tetap vs tunjangan tidak tetap.
--
-- "Upah sebulan" dalam Permenaker 6/2016 (THR) dan dalam tarif harian
-- pencairan cuti adalah gaji pokok + tunjangan TETAP — tidak termasuk
-- tunjangan tidak tetap seperti transport harian atau makan per shift.
-- `thr.ts` sudah menuliskan aturan itu sejak awal, tetapi datanya tidak ada
-- untuk menyatakannya: pencairan cuti memperlakukan SETIAP komponen ALLOWANCE
-- sebagai tunjangan tetap, dan THR hanya memakai gaji pokok.
--
-- BACKFILL DISENGAJA: baris ALLOWANCE yang sudah ada ditandai 1, bukan default
-- 0. Tanpa itu, perusahaan yang sedang menyalakan
-- `leave_encashment_include_allowances` akan tiba-tiba mendapat tarif harian
-- yang lebih kecil setelah rilis ini — perubahan uang yang senyap. Dengan
-- backfill, perilaku untuk data yang ada identik; komponen BARU harus ditandai
-- secara sadar.

SET @missing := (
  SELECT COUNT(*) = 0 FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'salary_components'
    AND column_name = 'is_fixed_allowance');

SET @col := IF(@missing,
  'ALTER TABLE `salary_components` ADD COLUMN `is_fixed_allowance` BOOLEAN NOT NULL DEFAULT false',
  'DO 0');
PREPARE stmt FROM @col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill hanya ketika kolomnya baru saja ditambahkan, bukan setiap kali
-- migrasi ini dijalankan. Mem-backfill berdasarkan `is_fixed_allowance = 0`
-- akan menimpa komponen yang SENGAJA ditandai tidak-tetap oleh tenant
-- setelahnya — mengembalikannya ke tetap dan menaikkan THR tanpa ada yang
-- memintanya.
SET @fill := IF(@missing,
  'UPDATE `salary_components` SET `is_fixed_allowance` = true WHERE `type` = ''ALLOWANCE''',
  'DO 0');
PREPARE stmt FROM @fill; EXECUTE stmt; DEALLOCATE PREPARE stmt;
