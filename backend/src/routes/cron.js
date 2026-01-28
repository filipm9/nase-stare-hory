import { Router } from 'express';
import { syncAll } from '../services/sync.js';
import { config } from '../config.js';

const router = Router();

// Cron endpoint for Railway
// This should be called by Railway Cron with Authorization: Bearer <secret>
router.post('/sync', async (req, res) => {
  try {
    // Verify cron secret via Bearer token
    const authHeader = req.headers.authorization;
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (!config.cronSecret || providedSecret !== config.cronSecret) {
      console.warn('Invalid cron secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('Cron job started: syncing data...');
    const result = await syncAll();
    console.log('Cron job completed:', result);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Cron sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check for Railway
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

export default router;
