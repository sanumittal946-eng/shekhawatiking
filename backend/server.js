require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const { seedAdmin } = require('./scripts/seed-admin');
const { runMigrations } = require('./scripts/migrate');
const { securityHeaders, loginRateLimiter, apiRateLimiter } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const numbersRoutes = require('./routes/numbers');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// Security headers (XSS, clickjacking, MIME sniffing protection)
app.use(securityHeaders);

// Restrict CORS to known origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isRender = origin.endsWith('.onrender.com');
    const isAllowedEnv = allowedOrigins.includes(origin) || allowedOrigins.includes(origin + '/');

    if (isLocalhost || isRender || isAllowedEnv) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));

// Rate limiting on all API routes
app.use('/api', apiRateLimiter);
app.use('/api/auth/login', loginRateLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/numbers', numbersRoutes);

// Serve frontend static files
const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot, {
  dotfiles: 'deny',
  index: 'index.html'
}));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(staticRoot, 'admin', 'login.html'));
});

// Health check — minimal info (no internal details exposed)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});

// Block access to sensitive paths
app.use(['/backend', '/.env'], (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.warn('Warning: Set JWT_SECRET to at least 32 random characters in .env');
  }

  try {
    await pool.query('SELECT 1');
    console.log('MySQL connected.');
    await runMigrations(pool);
    await seedAdmin();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Make sure MySQL is running and credentials in .env are correct.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (!isProd) {
      console.log(`Admin login: http://localhost:${PORT}/admin/login.html`);
    }
  });
}

start();
