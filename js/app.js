/**
 * Main page — number display, flip animation, and live countdown.
 */

(function () {
  'use strict';

  const numberEl = document.getElementById('numberDisplay');
  const loadingEl = document.getElementById('loadingOverlay');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const nextSlotLabelEl = document.getElementById('nextSlotLabel');
  const historyBodyEl = document.getElementById('historyBody');

  let currentNumber = null;
  let countdownInterval = null;
  let unsubscribe = null;
  let lastSecond = -1;
  let serverSchedule = null;
  let driftOffset = 0;

  /**
   * Animate number change with flip effect.
   */
  function animateNumberChange(newValue) {
    if (currentNumber === newValue) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (currentNumber === null || prefersReduced) {
      numberEl.textContent = newValue;
      currentNumber = newValue;
      return;
    }

    numberEl.classList.remove('flip-in', 'scale-pop');
    numberEl.classList.add('flip-out');

    numberEl.addEventListener('animationend', function onFlipOut(e) {
      if (e.animationName !== 'flipOut') return;
      numberEl.removeEventListener('animationend', onFlipOut);

      numberEl.textContent = newValue;
      numberEl.classList.remove('flip-out');
      numberEl.classList.add('flip-in');

      numberEl.addEventListener('animationend', function onFlipIn(e2) {
        if (e2.animationName !== 'flipIn') return;
        numberEl.removeEventListener('animationend', onFlipIn);
        numberEl.classList.remove('flip-in');
      });
    });

    currentNumber = newValue;
  }

  /**
   * Update countdown display with segment tick animation.
   */
  function updateCountdown() {
    let remaining = 0;
    let nextSlotLabel = '12:00 PM';

    if (serverSchedule) {
      const synchronizedNow = Date.now() + driftOffset;
      remaining = serverSchedule.nextUpdateMs - synchronizedNow;
      nextSlotLabel = serverSchedule.nextSlotLabel;
    } else {
      const state = getScheduleState();
      const now = new Date();
      remaining = state.nextUpdate - now;
      nextSlotLabel = state.nextSlotLabel;
    }

    if (nextSlotLabelEl) {
      nextSlotLabelEl.textContent = nextSlotLabel;
    }

    const formatted = formatCountdown(remaining);
    const [h, m, s] = formatted.split(':');

    if (hoursEl.textContent !== h) hoursEl.textContent = h;
    if (minutesEl.textContent !== m) minutesEl.textContent = m;

    if (secondsEl.textContent !== s) {
      secondsEl.textContent = s;
      secondsEl.classList.remove('tick');
      void secondsEl.offsetWidth;
      secondsEl.classList.add('tick');
    }

    // When countdown hits zero, refresh the displayed number
    if (remaining <= 0 && lastSecond !== 0) {
      refreshNumber();
    }
    lastSecond = Math.floor(remaining / 1000);
  }

  /**
   * Fetch and display the current number.
   */
  async function refreshNumber() {
    try {
      const state = await getCurrentDisplayState();
      const changed = currentNumber !== state.number;
      animateNumberChange(state.number);
      if (state && typeof state.nextUpdateMs === 'number') {
        serverSchedule = {
          nextUpdateMs: state.nextUpdateMs,
          nextSlotLabel: state.nextSlotLabel
        };
        driftOffset = state.serverTimeMs - Date.now();
      }
      if (changed) {
        loadHistory();
      }
    } catch (err) {
      console.error('Failed to load number:', err);
    }
  }

  /**
   * Hide loading overlay with fade.
   */
  function hideLoading() {
    loadingEl.classList.add('hidden');
    loadingEl.setAttribute('aria-busy', 'false');
  }

  /**
   * Format history date nicely.
   */
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

  /**
   * Set message in history table body.
   */
  function setHistoryMessage(message, className) {
    if (!historyBodyEl) return;
    historyBodyEl.innerHTML = `
      <tr>
        <td colspan="3" class="${className || 'history-empty'}">${message}</td>
      </tr>
    `;
  }

  /**
   * Fetch and render past numbers history.
   */
  async function loadHistory() {
    if (!historyBodyEl) return;
    try {
      const history = await getNumberHistory(10);
      
      historyBodyEl.innerHTML = '';
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

        const noonCell = document.createElement('td');
        noonCell.className = 'history-number';
        noonCell.textContent = item.noon || '-';
        row.appendChild(noonCell);

        const eveningCell = document.createElement('td');
        eveningCell.className = 'history-number';
        eveningCell.textContent = item.four || '-';
        row.appendChild(eveningCell);

        historyBodyEl.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load number history:', err);
      setHistoryMessage('Could not load number history.', 'history-error');
    }
  }

  /**
   * Initialize the main page.
   */
  async function init() {
    await initDataService();

    await refreshNumber();
    hideLoading();

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);

    unsubscribe = subscribeToNumberChanges((num, state) => {
      const changed = currentNumber !== num;
      animateNumberChange(num);
      if (state && typeof state.nextUpdateMs === 'number') {
        serverSchedule = {
          nextUpdateMs: state.nextUpdateMs,
          nextSlotLabel: state.nextSlotLabel
        };
        driftOffset = state.serverTimeMs - Date.now();
      }
      if (changed) {
        loadHistory();
      }
    });

    // Re-check on tab focus (handles missed schedule transitions)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshNumber();
        updateCountdown();
      }
    });
  }

  window.addEventListener('beforeunload', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    if (unsubscribe) unsubscribe();
  });

  init();
})();
