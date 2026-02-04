import { Router } from 'express';
import { authRequired } from '../auth.js';
import {
  checkSnowForecast,
  getSnowForecast,
  getSnowAlerts,
  getUnreadSnowAlertsCount,
  markSnowAlertRead,
  markAllSnowAlertsRead,
  deleteSnowAlert,
  createTestSnowAlert,
} from '../services/snow-detector.js';

const router = Router();

// Check snow forecast and create alert if needed
router.post('/check', authRequired, async (req, res) => {
  try {
    const result = await checkSnowForecast();
    res.json(result);
  } catch (error) {
    console.error('Snow check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current forecast (for UI display)
router.get('/forecast', authRequired, async (req, res) => {
  try {
    const forecast = await getSnowForecast();
    res.json(forecast);
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get snow alerts
router.get('/alerts', authRequired, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await getSnowAlerts(limit);
    res.json(alerts);
  } catch (error) {
    console.error('Get snow alerts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/alerts/unread-count', authRequired, async (req, res) => {
  try {
    const count = await getUnreadSnowAlertsCount();
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark alert as read
router.patch('/alerts/:id/read', authRequired, async (req, res) => {
  try {
    await markSnowAlertRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all alerts as read
router.patch('/alerts/read-all', authRequired, async (req, res) => {
  try {
    await markAllSnowAlertsRead();
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create test alert
router.post('/alerts/test', authRequired, async (req, res) => {
  try {
    const alert = await createTestSnowAlert();
    res.json(alert);
  } catch (error) {
    console.error('Create test alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete alert
router.delete('/alerts/:id', authRequired, async (req, res) => {
  try {
    await deleteSnowAlert(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
