const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const {
  isLoginLocked,
  recordFailedLogin,
  clearLoginAttempts,
  getLockoutRemaining,
  isValidUsername,
  safeError
} = require('../middleware/security');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY = '8h';
const MIN_PASSWORD_LENGTH = 8;

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * POST /api/auth/login — username + password (bcrypt hash in MySQL).
 */
router.post('/login', async (req, res) => {
  const ip = getClientIp(req);

  try {
    if (isLoginLocked(ip)) {
      const mins = getLockoutRemaining(ip);
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${mins} minute(s).`
      });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1',
      [cleanUsername]
    );

    // Same error whether user exists or not — prevents username enumeration
    if (!rows.length) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    clearLoginAttempts(ip);

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({ token, username: admin.username });
  } catch (err) {
    safeError(res, 500, 'Login failed. Please try again.', err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.username, id: req.admin.id });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, (_req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const [rows] = await pool.query(
      'SELECT id, password_hash FROM admins WHERE id = ? LIMIT 1',
      [req.admin.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
      'UPDATE admins SET password_hash = ? WHERE id = ?',
      [newHash, req.admin.id]
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    safeError(res, 500, 'Could not update password. Please try again.', err);
  }
});

/**
 * POST /api/auth/change-username — requires current password.
 */
router.post('/change-username', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newUsername } = req.body;

    if (!currentPassword || !newUsername) {
      return res.status(400).json({ error: 'Current password and new username are required.' });
    }

    const cleanUsername = String(newUsername).trim().toLowerCase();

    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3–32 characters (letters, numbers, underscore only).' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM admins WHERE id = ? LIMIT 1',
      [req.admin.id]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    if (cleanUsername === rows[0].username) {
      return res.status(400).json({ error: 'New username is the same as your current username.' });
    }

    const [taken] = await pool.query(
      'SELECT id FROM admins WHERE username = ? AND id != ? LIMIT 1',
      [cleanUsername, req.admin.id]
    );

    if (taken.length) {
      return res.status(400).json({ error: 'That username is already taken.' });
    }

    await pool.query(
      'UPDATE admins SET username = ? WHERE id = ?',
      [cleanUsername, req.admin.id]
    );

    const token = jwt.sign(
      { id: rows[0].id, username: cleanUsername },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({ message: 'Username updated successfully.', username: cleanUsername, token });
  } catch (err) {
    safeError(res, 500, 'Could not update username. Please try again.', err);
  }
});

module.exports = router;
