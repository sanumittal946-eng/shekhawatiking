-- Create a limited MySQL user (production security)
-- Run as root: mysql -u root -p < database/secure-user.sql
-- Then update .env: DB_USER=number_app  DB_PASSWORD=your_strong_password

USE number_display;

-- Replace 'your_strong_app_password' with a long random password
CREATE USER IF NOT EXISTS 'number_app'@'localhost' IDENTIFIED BY 'your_strong_app_password';

-- Only the permissions this app needs — no DROP, no GRANT, no FILE
GRANT SELECT, INSERT, UPDATE ON number_display.admins TO 'number_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON number_display.daily_numbers TO 'number_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON number_display.live_override TO 'number_app'@'localhost';

FLUSH PRIVILEGES;
