const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { isValidUsername } = require('../middleware/security');

const BCRYPT_ROUNDS = 12;

/**
 * Seeds the admin account on startup.
 * Username and password from .env — password stored as bcrypt hash only.
 */
async function seedAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();

  if (!isValidUsername(username)) {
    console.warn('Warning: ADMIN_USERNAME must be 3–32 characters (letters, numbers, underscore).');
    return;
  }

  let passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!passwordHash) {
    const plainPassword = process.env.ADMIN_PASSWORD;
    if (!plainPassword) {
      console.warn('Warning: No ADMIN_PASSWORD or ADMIN_PASSWORD_HASH set. Skipping admin seed.');
      return;
    }
    passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }

  const [existing] = await pool.query(
    'SELECT id FROM admins WHERE username = ? LIMIT 1',
    [username]
  );

  if (existing.length) {
    if (process.env.ADMIN_PASSWORD_HASH) {
      await pool.query(
        'UPDATE admins SET password_hash = ? WHERE username = ?',
        [passwordHash, username]
      );
      console.log(`Admin user "${username}" password hash updated.`);
    } else {
      console.log(`Admin user "${username}" already exists.`);
    }
    return;
  }

  await pool.query(
    'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
    [username, passwordHash]
  );

  console.log(`Admin user "${username}" created with bcrypt-hashed password.`);
}

module.exports = { seedAdmin };
