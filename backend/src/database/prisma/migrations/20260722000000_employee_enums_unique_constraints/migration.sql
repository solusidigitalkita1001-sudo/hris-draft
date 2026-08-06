-- Task 1.13: convert gender/religion/marital_status/blood_type to enums.
-- Backfill legacy free-text values to canonical tokens BEFORE the type change,
-- otherwise MySQL coerces non-matching values to '' (invalid enum).

UPDATE `employees` SET `gender` = UPPER(`gender`) WHERE `gender` IS NOT NULL;
UPDATE `employees` SET `gender` = NULL WHERE `gender` NOT IN ('MALE', 'FEMALE');

UPDATE `employees` SET `religion` = 'ISLAM'             WHERE UPPER(`religion`) = 'ISLAM';
UPDATE `employees` SET `religion` = 'KRISTEN_PROTESTAN' WHERE UPPER(`religion`) IN ('KRISTEN', 'KRISTEN PROTESTAN', 'PROTESTAN');
UPDATE `employees` SET `religion` = 'KRISTEN_KATOLIK'   WHERE UPPER(`religion`) IN ('KATOLIK', 'KRISTEN KATOLIK');
UPDATE `employees` SET `religion` = 'HINDU'             WHERE UPPER(`religion`) = 'HINDU';
UPDATE `employees` SET `religion` = 'BUDDHA'            WHERE UPPER(`religion`) IN ('BUDDHA', 'BUDHA');
UPDATE `employees` SET `religion` = 'KONGHUCU'          WHERE UPPER(`religion`) IN ('KONGHUCU', 'KONGHUCHU');
UPDATE `employees` SET `religion` = NULL WHERE `religion` NOT IN ('ISLAM', 'KRISTEN_PROTESTAN', 'KRISTEN_KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', 'LAINNYA');

UPDATE `employees` SET `marital_status` = UPPER(`marital_status`) WHERE `marital_status` IS NOT NULL;
UPDATE `employees` SET `marital_status` = NULL WHERE `marital_status` NOT IN ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

UPDATE `employees` SET `blood_type` = UPPER(`blood_type`) WHERE `blood_type` IS NOT NULL;
UPDATE `employees` SET `blood_type` = NULL WHERE `blood_type` NOT IN ('A', 'B', 'AB', 'O');

-- AlterTable: apply enum types
ALTER TABLE `employees` MODIFY `gender` ENUM('MALE', 'FEMALE') NULL,
    MODIFY `religion` ENUM('ISLAM', 'KRISTEN_PROTESTAN', 'KRISTEN_KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', 'LAINNYA') NULL,
    MODIFY `marital_status` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED') NULL,
    MODIFY `blood_type` ENUM('A', 'B', 'AB', 'O') NULL;

-- Task 1.12: composite unique constraints (MySQL ignores NULLs, so blanks don't collide)
CREATE UNIQUE INDEX `employees_company_id_id_number_key` ON `employees`(`company_id`, `id_number`);
CREATE UNIQUE INDEX `employees_company_id_phone_key` ON `employees`(`company_id`, `phone`);
