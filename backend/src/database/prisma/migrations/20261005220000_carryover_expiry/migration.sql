-- Sisa GAP-06. PR #47 menyimpan berapa hari yang dibawa dari tahun lalu, dan
-- menyebut kolom itu prasyarat — bukan fiturnya. Fiturnya ini: tenggat.
--
-- Banyak perusahaan Indonesia mewajibkan hari bawaan dipakai sebelum tanggal
-- tertentu (umumnya akhir Maret). Tanpa tenggat, hari bawaan menumpuk tanpa
-- batas selain cap tahunan, dan tidak ada cara menyatakan kebijakan itu.
--
-- Kolomnya terpisah dari `expired_at` dengan sengaja: `expired_at` menandai
-- seluruh saldo tahun lalu habis masa pada pergantian tahun, sedangkan ini
-- menandai sebagian saldo tahun BERJALAN hangus di tengah tahun. Menggabungkan
-- keduanya akan membuat sweep tahunan dan sweep harian saling menimpa.

SET @col := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'leave_balances'
     AND column_name = 'carry_over_expired_at') = 0,
  'ALTER TABLE `leave_balances` ADD COLUMN `carry_over_expired_at` DATETIME(3) NULL',
  'DO 0');
PREPARE stmt FROM @col; EXECUTE stmt; DEALLOCATE PREPARE stmt;
