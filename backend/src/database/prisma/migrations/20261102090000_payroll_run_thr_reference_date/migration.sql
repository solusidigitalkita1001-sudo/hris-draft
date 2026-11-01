-- P-C3: tanggal hari raya untuk run THR.
--
-- Eligibilitas THR (Permenaker 6/2016) dan prorata masa kerja keduanya diukur
-- dari tanggal hari raya, bukan dari akhir periode payroll. Sebelum kolom ini
-- ada, satu-satunya tanggal yang dipunyai run adalah `period.end_date`, jadi
-- run THR yang dibuat di periode Maret untuk Idulfitri awal April memakai
-- tanggal yang salah — dan selisih beberapa hari memindahkan karyawan PKWTT
-- yang keluar ke dalam atau ke luar tenggang 30 hari.
--
-- NULL-able tanpa default: run yang sudah ada tetap memakai `period.end_date`,
-- jadi tidak ada satu baris pun yang ditulis ulang dan tidak ada angka
-- historis yang berubah artinya.

SET @col := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'payroll_runs'
     AND column_name = 'thr_reference_date') = 0,
  'ALTER TABLE `payroll_runs` ADD COLUMN `thr_reference_date` DATETIME(3) NULL',
  'DO 0');
PREPARE stmt FROM @col; EXECUTE stmt; DEALLOCATE PREPARE stmt;
