/**
 * Admin login — username + password.
 */

(function () {
  'use strict';

  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const serverHint = document.getElementById('serverHint');

  function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('visible');
  }

  function clearError() {
    loginError.textContent = '';
    loginError.classList.remove('visible');
  }

  async function checkBackend() {
    const ready = await initDataService();
    if (!ready) {
      serverHint.hidden = false;
      showError('Server is not running. Start the backend first (see hint below).');
      loginBtn.disabled = true;
      return false;
    }
    serverHint.hidden = true;
    loginBtn.disabled = false;
    return true;
  }

  async function checkExistingSession() {
    const backendUp = await checkBackend();
    if (!backendUp) return;

    const loggedIn = await waitForAuthState();
    if (loggedIn) {
      window.location.href = 'dashboard.html';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Please enter both username and password.');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      showError('Username must be 3–32 characters (letters, numbers, underscore).');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';

    try {
      const ready = await initDataService();
      if (!ready) {
        throw new Error('Server is not running. Run: cd backend && npm start');
      }
      await adminLogin(username, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(err.message || 'Invalid username or password.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });

  checkExistingSession();
})();
