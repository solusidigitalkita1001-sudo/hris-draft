-- Task 1.5 (SEC-014): track password hash generation. 1 = legacy bcrypt, 2 = Argon2id.
ALTER TABLE `users` ADD COLUMN `password_version` INTEGER NOT NULL DEFAULT 1;
