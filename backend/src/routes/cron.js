import { Router } from 'express';
import { syncAll } from '../services/sync.js';
import { checkSnowForecast } from '../services/snow-detector.js';
import { checkWastePickups } from '../services/waste-notifier.js';
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
    console.log('Cron sync completed:', result);

    // Check snow forecast
    console.log('Checking snow forecast...');
    const snowResult = await checkSnowForecast();
    console.log('Snow check completed:', snowResult);

    // Check waste pickups for tomorrow
    console.log('Checking waste pickups...');
    const wasteResult = await checkWastePickups();
    console.log('Waste check completed:', wasteResult);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      sync: result,
      snow: snowResult,
      waste: wasteResult,
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
