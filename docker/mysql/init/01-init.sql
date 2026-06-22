-- HRMS Enterprise - Database Initialization
-- This runs on first MySQL container start

CREATE DATABASE IF NOT EXISTS hris_enterprise CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user
CREATE USER IF NOT EXISTS 'hris_user'@'%' IDENTIFIED BY 'hris_password';
GRANT ALL PRIVILEGES ON hris_enterprise.* TO 'hris_user'@'%';
FLUSH PRIVILEGES;

-- Performance optimization
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL innodb_log_file_size = 268435456;     -- 256MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
SET GLOBAL max_connections = 200;
