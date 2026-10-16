/*
  Warnings:

  - You are about to drop the `asset_patrol_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `asset_patrol_logs` DROP FOREIGN KEY `asset_patrol_logs_asset_id_fkey`;

-- DropForeignKey
ALTER TABLE `asset_patrol_logs` DROP FOREIGN KEY `asset_patrol_logs_company_id_fkey`;

-- DropForeignKey
ALTER TABLE `asset_patrol_logs` DROP FOREIGN KEY `asset_patrol_logs_patrol_by_id_fkey`;

-- DropTable
DROP TABLE `asset_patrol_logs`;
