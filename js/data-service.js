/**
 * Data layer — communicates with the MySQL backend API.
 */

let apiReady = false;

function getToken() {
  const session = sessionStorage.getItem(STORAGE_KEYS.session);
  if (!session) return null;
  try {
    return JSON.parse(session).token;
  } catch {
    return null;
  }
}

function setSession(token, username) {
  sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ token, username }));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

/**
 * Authenticated fetch wrapper.
 */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/**
 * Initialize API connection (health check).
 */
async function initDataService() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    apiReady = data.status === 'ok';
  } catch {
    apiReady = false;
    console.warn('Backend not reachable. Start the server: cd backend && npm start');
  }
  return apiReady;
}

function isApiReady() {
  return apiReady;
}

/**
 * Read numbers for a specific date from the API.
 */
async function getNumbersForDate(dateKey) {
  const data = await apiFetch(`/api/numbers/${dateKey}`);
  return { noon: data.noon, four: data.four };
}

/**
 * Save both slot numbers for a selected date (admin only).
 */
async function saveNumbersForDate(dateKey, noon, four) {
  return apiFetch(`/api/numbers/${encodeURIComponent(dateKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ noon, four })
  });
}

async function saveTodayNumbers(noon, four) {
  return saveNumbersForDate(getTodayKey(), noon, four);
}

async function getNumberHistory(limit = 90) {
  const data = await apiFetch(`/api/numbers/history?limit=${encodeURIComponent(limit)}`);
  return data.history || [];
}

async function applyInstantNumber(number) {
  return apiFetch('/api/numbers/instant', {
    method: 'POST',
    body: JSON.stringify({ number })
  });
}

/**
 * Fetch the full current display state from the API.
 */
async function getCurrentDisplayState() {
  return apiFetch('/api/numbers/current');
}

/**
 * Resolve the number that should be displayed right now.
 */
async function getCurrentDisplayNumber() {
  const data = await getCurrentDisplayState();
  return data.number || '0';
}

/**
 * Poll the API for number changes.
 */
function subscribeToNumberChanges(callback) {
  let lastValue = null;

  const poll = async () => {
    try {
      const state = await getCurrentDisplayState();
      if (state.number !== lastValue) {
        lastValue = state.number;
        callback(state.number, state);
      }
    } catch (err) {
      console.warn('Poll failed:', err.message);
    }
  };

  poll();
  const interval = setInterval(poll, 2000);
  return () => clearInterval(interval);
}

/**
 * Admin login — credentials verified server-side against bcrypt hash in MySQL.
 */
async function adminLogin(username, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  setSession(data.token, data.username);
  return data;
}

async function adminLogout() {
  const token = getToken();
  if (token) {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session even if server call fails
    }
  }
  clearSession();
}

function isAdminLoggedIn() {
  return !!getToken();
}

async function changePassword(currentPassword, newPassword) {
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

async function changeUsername(currentPassword, newUsername) {
  const data = await apiFetch('/api/auth/change-username', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newUsername })
  });
  if (data.token) {
    setSession(data.token, data.username);
  }
  return data;
}

async function waitForAuthState() {
  const token = getToken();
  if (!token) return false;

  try {
    await apiFetch('/api/auth/me');
    return true;
  } catch {
    clearSession();
    return false;
  }
}
