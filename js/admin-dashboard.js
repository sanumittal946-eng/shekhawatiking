/**
 * Admin dashboard — schedule saves vs instant go-live are separate.
 */

(function () {
  'use strict';

  const form = document.getElementById('dashboardForm');
  const noonInput = document.getElementById('noonNumber');
  const fourInput = document.getElementById('fourNumber');
  const noonError = document.getElementById('noonError');
  const fourError = document.getElementById('fourError');
  const saveBtn = document.getElementById('saveBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const previewNumber = document.getElementById('previewNumber');
  const previewSlot = document.getElementById('previewSlot');
  const dashboardDate = document.getElementById('dashboardDate');
  const scheduleDateInput = document.getElementById('scheduleDate');
  const dateError = document.getElementById('dateError');
  const todayDateBtn = document.getElementById('todayDateBtn');
  const successToast = document.getElementById('successToast');
  const historyBody = document.getElementById('historyBody');
  const historyStatus = document.getElementById('historyStatus');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

  const instantInput = document.getElementById('instantNumber');
  const instantApplyBtn = document.getElementById('instantApplyBtn');
  const instantStatus = document.getElementById('instantStatus');

  const passwordToggle = document.getElementById('accountToggle');
  const accountPanel = document.getElementById('accountPanel');
  const usernameForm = document.getElementById('usernameForm');
  const passwordForm = document.getElementById('passwordForm');
  const passwordError = document.getElementById('passwordError');
  const usernameError = document.getElementById('usernameError');
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changeUsernameBtn = document.getElementById('changeUsernameBtn');
  const currentUsernameEl = document.getElementById('currentUsername');

  function formatDisplayDate() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function showToast(message) {
    successToast.querySelector('.toast-message').textContent = message;
    successToast.classList.add('show');
    setTimeout(() => successToast.classList.remove('show'), 3500);
  }

  function formatHistoryDate(dateKey) {
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
      return { label: dateKey, helper: '' };
    }

    return {
      label: date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      }),
      helper: date.toLocaleDateString('en-US', { weekday: 'long' })
    };
  }

  function formatHistoryTime(value) {
    if (!value) return '-';

    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function setHistoryMessage(message, className) {
    historyBody.innerHTML = '';

    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = className || 'history-empty';
    cell.textContent = message;
    row.appendChild(cell);
    historyBody.appendChild(row);
  }

  function appendTextCell(row, text, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    row.appendChild(cell);
    return cell;
  }

  function renderHistory(history) {
    historyBody.innerHTML = '';

    if (!history.length) {
      setHistoryMessage('No saved number history yet.', 'history-empty');
      return;
    }

    const today = getTodayKey();

    history.forEach((item) => {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      const formattedDate = formatHistoryDate(item.dateKey);
      const helper = item.dateKey === today ? 'Today' : formattedDate.helper;

      dateCell.className = 'history-date';
      dateCell.textContent = formattedDate.label;

      if (helper) {
        const small = document.createElement('small');
        small.textContent = helper;
        dateCell.appendChild(small);
      }

      row.appendChild(dateCell);
      appendTextCell(row, item.noon || '0', 'history-number');
      appendTextCell(row, item.four || '0', 'history-number');
      appendTextCell(row, formatHistoryTime(item.updatedAt));
      historyBody.appendChild(row);
    });
  }

  function showDateError(message) {
    scheduleDateInput.classList.add('error');
    dateError.textContent = message || 'Please choose a valid date.';
    dateError.classList.add('visible');
  }

  function clearDateError() {
    scheduleDateInput.classList.remove('error');
    dateError.classList.remove('visible');
  }

  function getSelectedDateKey() {
    return scheduleDateInput.value;
  }

  function setSelectedDate(dateKey) {
    scheduleDateInput.value = dateKey;
    clearDateError();
  }

  function validateSelectedDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(getSelectedDateKey())) {
      showDateError('Please choose a valid date.');
      return false;
    }

    clearDateError();
    return true;
  }

  async function loadHistory() {
    refreshHistoryBtn.disabled = true;
    historyStatus.textContent = 'Loading saved number history...';

    try {
      const history = await getNumberHistory(365);
      renderHistory(history);
      historyStatus.textContent = history.length
        ? `${history.length} saved day${history.length === 1 ? '' : 's'} shown.`
        : 'Saved days will appear here after you save a schedule.';
    } catch (err) {
      setHistoryMessage(err.message || 'Could not load number history.', 'history-error');
      historyStatus.textContent = 'History could not be loaded.';
    } finally {
      refreshHistoryBtn.disabled = false;
    }
  }

  function validateField(input, errorEl) {
    const value = input.value.trim();
    if (!value) {
      input.classList.add('error');
      errorEl.textContent = 'This field is required.';
      errorEl.classList.add('visible');
      return false;
    }
    if (!isValidNumber(value)) {
      input.classList.add('error');
      errorEl.textContent = 'Please enter numbers only.';
      errorEl.classList.add('visible');
      return false;
    }
    input.classList.remove('error');
    errorEl.classList.remove('visible');
    return true;
  }

  /** Dashboard preview only — does NOT affect the live website */
  function updateSchedulePreview(value, slotLabel) {
    const display = value.length > 0 ? value : '0';
    previewNumber.textContent = display;
    previewNumber.classList.remove('updated');
    void previewNumber.offsetWidth;
    previewNumber.classList.add('updated');
    previewSlot.textContent = `Preview only — ${slotLabel} (goes live at scheduled time)`;
  }

  /** Instant box preview */
  function updateInstantPreview(value) {
    const display = value.length > 0 ? value : '0';
    previewNumber.textContent = display;
    previewNumber.classList.remove('updated');
    void previewNumber.offsetWidth;
    previewNumber.classList.add('updated');
    previewSlot.textContent = value.length > 0
      ? 'Preview — click Go Live Now to publish'
      : 'Enter a number above and click Go Live Now';
  }

  function setupSchedulePreview(input, slotLabel) {
    input.addEventListener('focus', () => {
      updateSchedulePreview(input.value.trim(), slotLabel);
    });

    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
      updateSchedulePreview(input.value.trim(), slotLabel);
    });
  }

  function setInstantStatus(message, isLive) {
    instantStatus.textContent = message;
    instantStatus.classList.toggle('live', !!isLive);
  }

  async function publishInstant(number) {
    if (!isValidNumber(number)) {
      alert('Please enter a valid number (digits only).');
      return;
    }

    instantApplyBtn.disabled = true;
    instantApplyBtn.textContent = 'Publishing…';

    try {
      await applyInstantNumber(number);
      previewNumber.textContent = number;
      previewSlot.textContent = `LIVE on website: ${number}`;
      setInstantStatus(`✓ ${number} is live now!`, true);
      showToast(`${number} is now live on the website!`);
    } catch (err) {
      alert('Failed to publish: ' + (err.message || 'Unknown error'));
    } finally {
      instantApplyBtn.disabled = false;
      instantApplyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
        Go Live Now`;
    }
  }

  async function loadNumbersForSelectedDate() {
    if (!validateSelectedDate()) return;

    const numbers = await getNumbersForDate(getSelectedDateKey());
    noonInput.value = numbers.noon === '0' ? '' : numbers.noon;
    fourInput.value = numbers.four === '0' ? '' : numbers.four;
  }

  async function loadCurrentPreview() {
    try {
      const current = await apiFetch('/api/numbers/current');
      if (current.instant) {
        instantInput.value = current.number === '0' ? '' : current.number;
        previewNumber.textContent = current.number;
        previewSlot.textContent = `LIVE on website: ${current.number} (instant)`;
        setInstantStatus(`Instant number active: ${current.number}`, true);
      } else {
        previewNumber.textContent = current.number;
        previewSlot.textContent = `Currently live: ${current.number} (from schedule)`;
        setInstantStatus('');
      }
    } catch {
      previewNumber.textContent = '0';
    }
  }

  async function requireAuth() {
    await initDataService();
    if (!isApiReady()) {
      alert('Backend server is not running.\n\nRun: cd backend && npm start');
      window.location.href = 'login.html';
      return false;
    }
    const loggedIn = await waitForAuthState();
    if (!loggedIn) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  instantInput.addEventListener('input', () => {
    instantInput.value = instantInput.value.replace(/\D/g, '');
    updateInstantPreview(instantInput.value.trim());
  });

  instantInput.addEventListener('focus', () => {
    updateInstantPreview(instantInput.value.trim());
  });

  instantApplyBtn.addEventListener('click', () => {
    const num = instantInput.value.trim();
    if (!num) {
      alert('Enter a number in the Instant Change box, then click Go Live Now.');
      instantInput.focus();
      return;
    }
    publishInstant(num);
  });

  scheduleDateInput.addEventListener('change', () => {
    loadNumbersForSelectedDate().catch((err) => {
      showDateError(err.message || 'Could not load numbers for this date.');
    });
  });

  todayDateBtn.addEventListener('click', () => {
    setSelectedDate(getTodayKey());
    loadNumbersForSelectedDate().catch((err) => {
      showDateError(err.message || 'Could not load today\'s numbers.');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dateValid = validateSelectedDate();
    const noonValid = validateField(noonInput, noonError);
    const fourValid = validateField(fourInput, fourError);
    if (!dateValid || !noonValid || !fourValid) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await saveNumbersForDate(
        getSelectedDateKey(),
        noonInput.value.trim(),
        fourInput.value.trim()
      );
      showToast('Saved! Numbers will go live at 12:00 PM and 8:00 PM.');
      loadHistory();
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Save Schedule`;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await adminLogout();
    window.location.href = 'login.html';
  });

  refreshHistoryBtn.addEventListener('click', loadHistory);

  passwordToggle.addEventListener('click', () => {
    const isHidden = accountPanel.classList.contains('hidden');
    accountPanel.classList.toggle('hidden', !isHidden);
    passwordToggle.setAttribute('aria-expanded', String(isHidden));
  });

  usernameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    usernameError.classList.remove('visible');
    usernameError.textContent = '';

    const currentPass = document.getElementById('usernameCurrentPassword').value;
    const newUser = document.getElementById('newUsername').value.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(newUser)) {
      usernameError.textContent = 'Username must be 3–32 characters (letters, numbers, underscore).';
      usernameError.classList.add('visible');
      return;
    }

    changeUsernameBtn.disabled = true;
    changeUsernameBtn.textContent = 'Updating…';

    try {
      const result = await changeUsername(currentPass, newUser);
      currentUsernameEl.textContent = result.username;
      usernameForm.reset();
      showToast('Username updated to: ' + result.username);
    } catch (err) {
      usernameError.textContent = err.message || 'Failed to update username.';
      usernameError.classList.add('visible');
    } finally {
      changeUsernameBtn.disabled = false;
      changeUsernameBtn.textContent = 'Update Username';
    }
  });

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordError.classList.remove('visible');
    passwordError.textContent = '';

    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (newPass.length < 8) {
      passwordError.textContent = 'New password must be at least 8 characters.';
      passwordError.classList.add('visible');
      return;
    }
    if (newPass !== confirm) {
      passwordError.textContent = 'New passwords do not match.';
      passwordError.classList.add('visible');
      return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = 'Updating…';

    try {
      await changePassword(current, newPass);
      passwordForm.reset();
      showToast('Password updated successfully!');
    } catch (err) {
      passwordError.textContent = err.message || 'Failed to update password.';
      passwordError.classList.add('visible');
    } finally {
      changePasswordBtn.disabled = false;
      changePasswordBtn.textContent = 'Update Password';
    }
  });

  setupSchedulePreview(noonInput, '12:00 PM');
  setupSchedulePreview(fourInput, '8:00 PM');

  async function init() {
    const authed = await requireAuth();
    if (!authed) return;
    dashboardDate.textContent = formatDisplayDate();
    setSelectedDate(getTodayKey());
    try {
      const me = await apiFetch('/api/auth/me');
      currentUsernameEl.textContent = me.username;
    } catch { /* ignore */ }
    await loadNumbersForSelectedDate();
    await loadCurrentPreview();
    await loadHistory();
  }

  init();
})();
