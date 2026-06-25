/**
 * Security middleware — rate limiting, headers, login lockout.
 */
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/** Failed login attempts per IP (in-memory; resets on server restart) */
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isLoginLocked(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(ip);
  }
  return false;
}

function recordFailedLogin(ip) {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    record.count = 0;
  }
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function getLockoutRemaining(ip) {
  const record = loginAttempts.get(ip);
  if (!record?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((record.lockedUntil - Date.now()) / 60000));
}

/** Validate username: 3–32 chars, letters, numbers, underscore only */
function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(username);
}

/** Security HTTP headers */
const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
});

/** Strict limit on login — prevents brute-force attacks */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

/** General API rate limit */
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

/** Hide internal error details in production */
function safeError(res, status, publicMessage, err) {
  if (err) console.error(publicMessage + ':', err.message || err);
  res.status(status).json({ error: publicMessage });
}

module.exports = {
  securityHeaders,
  loginRateLimiter,
  apiRateLimiter,
  isLoginLocked,
  recordFailedLogin,
  clearLoginAttempts,
  getLockoutRemaining,
  isValidUsername,
  safeError
};
