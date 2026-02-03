import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { runMigrations } from './db.js';
import { authRequired } from './auth.js';

import authRoutes from './routes/auth.js';
import waterRoutes from './routes/water.js';
import alertsRoutes from './routes/alerts.js';
import cronRoutes from './routes/cron.js';

const app = express();

// Trust proxy (behind load balancer)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS - must be before rate limiter to handle OPTIONS preflight
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? config.corsOrigin 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Rate limiting - skip OPTIONS requests to allow CORS preflight
app.use(rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
}));

// Body parsing & cookies
app.use(express.json());
app.use(cookieParser());

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Network diagnostics (public) - for debugging outbound connections
app.get('/diagnostics/network', async (req, res) => {
  const results = { 
    timestamp: new Date().toISOString(), 
    vasApiUrl: config.vas.apiUrl,
    tests: [] 
  };
  
  // Test 1: Google
  try {
    const start = Date.now();
    const r = await fetch('https://www.google.com', { method: 'HEAD' });
    results.tests.push({ name: 'Google', status: 'ok', ms: Date.now() - start, code: r.status });
  } catch (e) {
    results.tests.push({ name: 'Google', status: 'error', error: e.message });
  }
  
  // Test 2: Simple echo Worker (no VAS)
  try {
    const start = Date.now();
    const r = await fetch('https://test.filip-muller22.workers.dev/', { method: 'GET' });
    const data = await r.json();
    results.tests.push({ 
      name: 'CF Worker Echo', 
      status: 'ok', 
      ms: Date.now() - start, 
      code: r.status,
      colo: data.cf?.colo,
      country: data.cf?.country,
    });
  } catch (e) {
    results.tests.push({ name: 'CF Worker Echo', status: 'error', error: e.message });
  }
  
  // Test 3: VAS Proxy - test actual token endpoint
  try {
    const start = Date.now();
    const r = await fetch(`${config.vas.apiUrl}/connect/token`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: config.vas.username || '',
        password: config.vas.password || '',
        client_id: config.vas.clientId || '',
        client_secret: config.vas.clientSecret || '',
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text.substring(0, 200); }
    results.tests.push({ 
      name: 'VAS Token', 
      status: r.ok ? 'ok' : 'error', 
      ms: Date.now() - start,
      httpStatus: r.status,
      hasToken: !!parsed?.access_token,
      response: r.ok ? 'token received' : parsed,
    });
  } catch (e) {
    results.tests.push({ name: 'VAS Token', status: 'error', error: e.message });
  }
  
  res.json(results);
});

// Cron routes (protected by secret, not JWT)
app.use('/cron', cronRoutes);

// Auth routes (public)
app.use('/auth', authRoutes);

// Protected routes
app.use('/water', authRequired, waterRoutes);
app.use('/alerts', authRequired, alertsRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await runMigrations();
    
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
