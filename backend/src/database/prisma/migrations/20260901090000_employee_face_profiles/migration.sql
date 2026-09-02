CREATE TABLE `employee_face_profiles` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `encrypted_embedding` LONGTEXT NOT NULL,
  `model_version` VARCHAR(100) NOT NULL,
  `embedding_dimensions` INTEGER NOT NULL,
  `enrollment_confidence` DOUBLE NOT NULL,
  `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `employee_face_profiles_employee_id_key` (`employee_id`),
  INDEX `employee_face_profiles_company_id_idx` (`company_id`),
  CONSTRAINT `employee_face_profiles_employee_id_fkey`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `employee_face_profiles_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
