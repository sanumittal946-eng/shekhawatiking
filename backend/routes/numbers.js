const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ROUTE_REGEX = /^\/(\d{4}-\d{2}-\d{2})$/;

const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

function getPartsInTimezone(date, tz = TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1-12
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10)
  };
}

function getTodayKeyInTimezone(date, tz = TIMEZONE) {
  const parts = getPartsInTimezone(date, tz);
  const y = parts.year;
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateKeyOffsetInTimezone(days, baseDate, tz = TIMEZONE) {
  const date = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  return getTodayKeyInTimezone(date, tz);
}

function makeScheduledDateInTimezone(dateKey, hour, minute, tz = TIMEZONE) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const tempUtc = new Date(Date.UTC(y, m - 1, d, hour, minute, 0, 0));
  const parts = getPartsInTimezone(tempUtc, tz);
  const partsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  const offsetMs = partsUtc - tempUtc.getTime();
  return new Date(tempUtc.getTime() - offsetMs);
}

/**
 * Returns the active schedule boundary — number only updates when this boundary changes.
 */
function getCurrentBoundary(now = new Date()) {
  const todayKey = getTodayKeyInTimezone(now);
  const noonToday = makeScheduledDateInTimezone(todayKey, 12, 0);
  const eightToday = makeScheduledDateInTimezone(todayKey, 20, 0);

  if (now < noonToday) {
    const yesterdayKey = getDateKeyOffsetInTimezone(-1, now);
    const eightYesterday = makeScheduledDateInTimezone(yesterdayKey, 20, 0);
    return { boundaryTime: eightYesterday, boundaryMs: eightYesterday.getTime(), dateKey: yesterdayKey, slot: 'four_pm', label: '8:00 PM' };
  }
  if (now < eightToday) {
    return { boundaryTime: noonToday, boundaryMs: noonToday.getTime(), dateKey: todayKey, slot: 'noon', label: '12:00 PM' };
  }
  return { boundaryTime: eightToday, boundaryMs: eightToday.getTime(), dateKey: todayKey, slot: 'four_pm', label: '8:00 PM' };
}

function getNextScheduleAfter(date) {
  const dateKey = getTodayKeyInTimezone(date);
  const noon = makeScheduledDateInTimezone(dateKey, 12, 0);
  const eight = makeScheduledDateInTimezone(dateKey, 20, 0);
  if (date < noon) return { date: noon, label: '12:00 PM' };
  if (date < eight) return { date: eight, label: '8:00 PM' };
  const tomorrowKey = getDateKeyOffsetInTimezone(1, date);
  return { date: makeScheduledDateInTimezone(tomorrowKey, 12, 0), label: '12:00 PM' };
}

async function getActiveInstantOverride() {
  const [rows] = await pool.query(
    'SELECT number, active, UNIX_TIMESTAMP(set_at) * 1000 AS set_at_ms FROM live_override WHERE id = 1 LIMIT 1'
  );
  if (!rows.length || !rows[0].active) return null;

  const setAt = new Date(Number(rows[0].set_at_ms));
  const now = new Date();
  const nextBound = getNextScheduleAfter(setAt);

  if (now >= nextBound.date) {
    await pool.query('UPDATE live_override SET active = 0 WHERE id = 1');
    return null;
  }

  return {
    number: rows[0].number,
    nextUpdateMs: nextBound.date.getTime(),
    nextSlotLabel: nextBound.label
  };
}

async function setInstantOverride(number) {
  await pool.query(
    'UPDATE live_override SET number = ?, active = 1, set_at = NOW() WHERE id = 1',
    [String(number)]
  );
}

async function getNumbersRow(dateKey) {
  const [rows] = await pool.query(
    'SELECT noon, four_pm FROM daily_numbers WHERE date_key = ? LIMIT 1',
    [dateKey]
  );
  return rows[0] || { noon: '0', four_pm: '0' };
}

async function saveNumbersRow(dateKey, noon, four) {
  await pool.query(
    `INSERT INTO daily_numbers (date_key, noon, four_pm)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE noon = VALUES(noon), four_pm = VALUES(four_pm)`,
    [dateKey, String(noon), String(four)]
  );
}

function validateNumberPair(noon, four) {
  return /^\d+$/.test(String(noon ?? '')) && /^\d+$/.test(String(four ?? ''));
}

function todayKey(now = new Date()) {
  return getTodayKeyInTimezone(now);
}

/**
 * Scheduled number on screen — only refreshes when a 12 PM or 8 PM boundary is crossed.
 */
async function getScheduledDisplayNumber() {
  const boundary = getCurrentBoundary();
  const [rows] = await pool.query(
    'SELECT number, boundary_ms FROM schedule_display WHERE id = 1 LIMIT 1'
  );

  const cached = rows[0];
  if (cached && Number(cached.boundary_ms) === boundary.boundaryMs) {
    return { number: cached.number, boundary };
  }

  const row = await getNumbersRow(boundary.dateKey);
  const number = row[boundary.slot] || '0';

  await pool.query(
    `INSERT INTO schedule_display (id, number, boundary_ms) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE number = VALUES(number), boundary_ms = VALUES(boundary_ms)`,
    [number, boundary.boundaryMs]
  );

  return { number, boundary };
}

/**
 * GET /api/numbers/current — public display number.
 */
router.get('/current', async (_req, res) => {
  try {
    const now = new Date();
    const instant = await getActiveInstantOverride();
    if (instant !== null) {
      return res.json({
        number: instant.number,
        source: 'instant',
        instant: true,
        nextUpdateMs: instant.nextUpdateMs,
        nextSlotLabel: instant.nextSlotLabel,
        serverTimeMs: now.getTime(),
        timezone: TIMEZONE
      });
    }

    const { number, boundary } = await getScheduledDisplayNumber();
    const nextBound = getNextScheduleAfter(now);

    res.json({
      number,
      slot: boundary.slot === 'noon' ? 'noon' : 'evening',
      slotLabel: boundary.label,
      dateKey: boundary.dateKey,
      source: 'schedule',
      instant: false,
      nextUpdateMs: nextBound.date.getTime(),
      nextSlotLabel: nextBound.label,
      serverTimeMs: now.getTime(),
      timezone: TIMEZONE
    });
  } catch (err) {
    console.error('GET /current error:', err);
    res.status(500).json({ error: 'Failed to fetch current number.' });
  }
});

/**
 * GET /api/numbers/today
 */
router.get('/today', async (_req, res) => {
  try {
    const key = todayKey();
    const row = await getNumbersRow(key);
    const instant = await getActiveInstantOverride();

    res.json({
      dateKey: key,
      noon: row.noon,
      four: row.four_pm,
      instantActive: instant !== null,
      instantNumber: instant ? instant.number : null
    });
  } catch (err) {
    console.error('GET /today error:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s numbers.' });
  }
});

/**
 * GET /api/numbers/history — public: saved daily number history.
 */
router.get('/history', async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 90);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 365)
      : 90;

    const [rows] = await pool.query(
      `SELECT
         DATE_FORMAT(date_key, '%Y-%m-%d') AS dateKey,
         noon,
         four_pm AS four,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
       FROM daily_numbers
       ORDER BY date_key DESC
       LIMIT ?`,
      [limit]
    );

    res.json({ history: rows, count: rows.length });
  } catch (err) {
    console.error('GET /history error:', err);
    res.status(500).json({ error: 'Failed to fetch number history.' });
  }
});

/**
 * POST /api/numbers/instant — admin only: go live immediately (Instant Change box).
 */
router.post('/instant', requireAuth, async (req, res) => {
  try {
    const { number } = req.body;

    if (!/^\d+$/.test(String(number ?? ''))) {
      return res.status(400).json({ error: 'Number must contain digits only.' });
    }

    await setInstantOverride(number);

    res.json({
      message: 'Number is now live on the website!',
      number: String(number),
      instant: true
    });
  } catch (err) {
    console.error('POST /instant error:', err);
    res.status(500).json({ error: 'Failed to publish number instantly.' });
  }
});

/**
 * GET /api/numbers/:dateKey — admin only
 */
router.get(DATE_ROUTE_REGEX, requireAuth, async (req, res) => {
  try {
    const dateKey = req.params[0];
    if (!DATE_REGEX.test(dateKey)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const row = await getNumbersRow(dateKey);
    res.json({ dateKey, noon: row.noon, four: row.four_pm });
  } catch (err) {
    console.error('GET /:dateKey error:', err);
    res.status(500).json({ error: 'Failed to fetch numbers.' });
  }
});

/**
 * PUT /api/numbers/:dateKey — admin only: save schedule for a selected date.
 */
router.put(DATE_ROUTE_REGEX, requireAuth, async (req, res) => {
  try {
    const dateKey = req.params[0];
    const { noon, four } = req.body;

    if (!DATE_REGEX.test(dateKey)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    if (!validateNumberPair(noon, four)) {
      return res.status(400).json({ error: 'Both numbers must contain digits only.' });
    }

    await saveNumbersRow(dateKey, noon, four);

    res.json({
      message: 'Saved for schedule. Will go live at 12:00 PM and 8:00 PM.',
      dateKey,
      noon: String(noon),
      four: String(four)
    });
  } catch (err) {
    console.error('PUT /:dateKey error:', err);
    res.status(500).json({ error: 'Failed to save numbers.' });
  }
});

/**
 * PUT /api/numbers/today — save for schedule only (goes live at 12 PM / 8 PM, not now).
 */
router.put('/today', requireAuth, async (req, res) => {
  try {
    const { noon, four } = req.body;

    if (!validateNumberPair(noon, four)) {
      return res.status(400).json({ error: 'Both numbers must contain digits only.' });
    }

    const key = todayKey();

    await saveNumbersRow(key, noon, four);

    res.json({
      message: 'Saved for schedule. Will go live at 12:00 PM and 8:00 PM.',
      dateKey: key,
      noon: String(noon),
      four: String(four)
    });
  } catch (err) {
    console.error('PUT /today error:', err);
    res.status(500).json({ error: 'Failed to save numbers.' });
  }
});

module.exports = router;
