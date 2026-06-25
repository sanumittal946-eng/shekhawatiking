/**
 * API configuration — auto-detects backend URL.
 * Works when served by Node (port 3000), XAMPP, or opened as a local file.
 */
const API_BASE = (() => {
  const BACKEND = 'http://localhost:3000';

  // Opening HTML files directly (file://) — API must point to backend
  if (window.location.protocol === 'file:') {
    return BACKEND;
  }

  // Served on a different port (e.g. python http.server) — use backend
  if (window.location.port && window.location.port !== '3000') {
    return BACKEND;
  }

  // Same origin when served by Node.js on port 3000
  return '';
})();
