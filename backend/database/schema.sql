-- Number Display — MySQL Schema
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS number_display
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE number_display;

-- Admin accounts (username + bcrypt hash only — never plain text)
CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Daily scheduled numbers (12 PM and 8 PM slots; four_pm stores the evening slot)
CREATE TABLE IF NOT EXISTS daily_numbers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_key   DATE NOT NULL UNIQUE,
  noon       VARCHAR(50) NOT NULL DEFAULT '0',
  four_pm    VARCHAR(50) NOT NULL DEFAULT '0',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Instant live override
CREATE TABLE IF NOT EXISTS live_override (
  id         TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  number     VARCHAR(50) NOT NULL DEFAULT '0',
  active     TINYINT(1) NOT NULL DEFAULT 0,
  set_at     TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO live_override (id, number, active) VALUES (1, '0', 0);

-- Optional: limited MySQL user (run secure-user.sql separately for production)
