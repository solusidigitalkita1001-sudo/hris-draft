-- GAP-40: tabel Tarif Efektif Rata-rata (TER) bulanan, PP 58/2023 Lampiran
-- huruf A, B dan C.
--
-- Data referensi, bukan konstanta — alasan yang sama seperti `tax_brackets`:
-- lampirannya 125 baris di tiga kategori, dan peraturan berikutnya
-- menggantinya sekaligus. Jadi dimuat per tahun, dan boleh ditimpa per
-- perusahaan.
--
-- `upper_bound` NULL berarti lapisan teratas yang terbuka ("di atas X"),
-- berbeda dari `tax_brackets` yang memakai sentinel 9e14. NULL dipilih karena
-- jujur: tidak ada batas, bukan batas yang sangat besar.

CREATE TABLE IF NOT EXISTS `ter_brackets` (
    `id` VARCHAR(36) NOT NULL,
    `company_id` VARCHAR(36) NULL,
    `year` INTEGER NOT NULL,
    `category` ENUM('A', 'B', 'C') NOT NULL,
    `level` INTEGER NOT NULL,
    `upper_bound` DECIMAL(18, 2) NULL,
    `rate_percent` DECIMAL(6, 3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ter_brackets_year_category_idx`(`year`, `category`),
    UNIQUE INDEX `ter_brackets_company_id_year_category_level_key`(`company_id`, `year`, `category`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @fk := IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'ter_brackets'
     AND constraint_name = 'ter_brackets_company_id_fkey') = 0,
  'ALTER TABLE `ter_brackets` ADD CONSTRAINT `ter_brackets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'DO 0');
PREPARE stmt FROM @fk; EXECUTE stmt; DEALLOCATE PREPARE stmt;
