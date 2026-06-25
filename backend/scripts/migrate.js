/**
 * Database migrations — runs safely on every server start.
 */
async function runMigrations(pool) {
  // Admins table with username (migrate from old email column if needed)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username      VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const [emailCol] = await pool.query(
    "SHOW COLUMNS FROM admins LIKE 'email'"
  );
  if (emailCol.length) {
    await pool.query(`
      UPDATE admins SET email = SUBSTRING_INDEX(email, '@', 1)
      WHERE email LIKE '%@%'
    `);
    await pool.query(`
      ALTER TABLE admins CHANGE email username VARCHAR(50) NOT NULL UNIQUE
    `);
    console.log('Migrated admins.email → admins.username');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_numbers (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      date_key   DATE NOT NULL UNIQUE,
      noon       VARCHAR(50) NOT NULL DEFAULT '0',
      four_pm    VARCHAR(50) NOT NULL DEFAULT '0',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_override (
      id         TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
      number     VARCHAR(50) NOT NULL DEFAULT '0',
      active     TINYINT(1) NOT NULL DEFAULT 0,
      set_at     TIMESTAMP NULL DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    INSERT IGNORE INTO live_override (id, number, active) VALUES (1, '0', 0)
  `);

  // Snapshot of what's on screen from schedule (only updates at 12 PM / 8 PM boundaries)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedule_display (
      id          TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
      number      VARCHAR(50) NOT NULL DEFAULT '0',
      boundary_ms BIGINT NOT NULL DEFAULT 0,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    INSERT IGNORE INTO schedule_display (id, number, boundary_ms) VALUES (1, '0', 0)
  `);
}

module.exports = { runMigrations };
