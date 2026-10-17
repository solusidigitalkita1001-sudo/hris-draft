-- Dasar upah harian (GAP-49): pay_basis pada employee_salaries.
-- MONTHLY = gaji sebulan (perilaku lama, default untuk semua baris yang ada);
-- DAILY = base_salary adalah tarif sehari, dibayar tarif x hari hadir.

ALTER TABLE `employee_salaries`
    ADD COLUMN `pay_basis` ENUM('MONTHLY', 'DAILY') NOT NULL DEFAULT 'MONTHLY' AFTER `base_salary`;
