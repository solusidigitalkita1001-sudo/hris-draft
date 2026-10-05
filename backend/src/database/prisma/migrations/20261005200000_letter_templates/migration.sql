-- GAP-46: tidak ada generator surat dari template. Surat keterangan kerja, SK
-- dan sejenisnya ditulis ulang satu per satu di luar sistem, padahal datanya
-- ada di sini.
--
-- `body` diisi tenant, dan itulah alasan penyusunnya bukan template engine
-- melainkan substitusi atas daftar placeholder tertutup — merender teks
-- karangan tenant lewat engine umum adalah permukaan eksekusi kode.
--
-- Tabel baru, tidak menyentuh apa pun yang sudah ada.

CREATE TABLE IF NOT EXISTS `letter_templates` (
  `id`          VARCHAR(36)  NOT NULL,
  `company_id`  VARCHAR(36)  NOT NULL,
  `code`        VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(255) NOT NULL,
  `body`        TEXT         NOT NULL,
  `description` TEXT         NULL,
  `is_active`   BOOLEAN      NOT NULL DEFAULT true,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)  NOT NULL,
  `deleted_at`  DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `letter_templates_company_id_code_key` (`company_id`, `code`),
  INDEX `letter_templates_company_id_is_active_idx` (`company_id`, `is_active`),
  CONSTRAINT `letter_templates_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
