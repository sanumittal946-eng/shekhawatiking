/**
 * Shared utilities for date handling, storage keys, and schedule logic.
 */

const STORAGE_KEYS = {
  session: 'numberWebsite_adminSession'
};

const SCHEDULE = {
  NOON_HOUR: 12,
  NOON_MINUTE: 0,
  EVENING_HOUR: 20,
  EVENING_MINUTE: 0
};

/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 */
function getTodayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns date key for N days offset from today.
 */
function getDateKeyOffset(days, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Creates a Date object for a scheduled time on a given date key.
 */
function makeScheduledDate(dateKey, hour, minute) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/**
 * Determines which slot is currently active and when the next update occurs.
 * @returns {{ activeSlot: 'noon'|'evening', nextUpdate: Date, nextSlotLabel: string }}
 */
function getScheduleState(now = new Date()) {
  const todayKey = getTodayKey(now);
  const noonToday = makeScheduledDate(todayKey, SCHEDULE.NOON_HOUR, SCHEDULE.NOON_MINUTE);
  const eveningToday = makeScheduledDate(todayKey, SCHEDULE.EVENING_HOUR, SCHEDULE.EVENING_MINUTE);

  if (now < noonToday) {
    return {
      activeSlot: 'evening',
      activeDateKey: getDateKeyOffset(-1, now),
      nextUpdate: noonToday,
      nextSlotLabel: '12:00 PM'
    };
  }

  if (now < eveningToday) {
    return {
      activeSlot: 'noon',
      activeDateKey: todayKey,
      nextUpdate: eveningToday,
      nextSlotLabel: '8:00 PM'
    };
  }

  const tomorrowKey = getDateKeyOffset(1, now);
  const noonTomorrow = makeScheduledDate(tomorrowKey, SCHEDULE.NOON_HOUR, SCHEDULE.NOON_MINUTE);

  return {
    activeSlot: 'evening',
    activeDateKey: todayKey,
    nextUpdate: noonTomorrow,
    nextSlotLabel: '12:00 PM'
  };
}

/**
 * Validates that a value contains only digits (optional leading minus not allowed).
 */
function isValidNumber(value) {
  return /^\d+$/.test(String(value).trim());
}

/**
 * Formats milliseconds into HH:MM:SS for countdown display.
 */
function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

/**
 * Debounce helper for input preview.
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
