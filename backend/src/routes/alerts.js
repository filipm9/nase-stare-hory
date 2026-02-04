import { Router } from 'express';
import { query } from '../db.js';
import { sendAlertEmail } from '../services/email.js';

const router = Router();

// Get ALL alerts (combined water + snow) for bell icon
router.get('/all', async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;

    // Combine water alerts and snow alerts with UNION
    let sql = `
      SELECT 
        a.id,
        'water' as module,
        a.alert_type,
        a.message,
        a.is_read,
        a.email_sent,
        a.created_at,
        m.address,
        a.value,
        a.threshold,
        NULL::decimal as snowfall_cm,
        NULL::integer as freezing_days
      FROM alerts a
      JOIN meters m ON a.meter_id = m.meter_id
      ${unreadOnly === 'true' ? 'WHERE a.is_read = false' : ''}
      
      UNION ALL
      
      SELECT 
        s.id,
        'snow' as module,
        s.alert_type,
        s.message,
        s.is_read,
        s.email_sent,
        s.created_at,
        NULL as address,
        NULL::decimal as value,
        NULL::decimal as threshold,
        s.snowfall_cm,
        s.freezing_days
      FROM snow_alerts s
      ${unreadOnly === 'true' ? 'WHERE s.is_read = false' : ''}
      
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await query(sql, [parseInt(limit)]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get all alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get combined unread count (water + snow)
router.get('/all/unread-count', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        (SELECT COUNT(*) FROM alerts WHERE is_read = false) +
        (SELECT COUNT(*) FROM snow_alerts WHERE is_read = false) as count
    `);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get combined unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Get water alerts only (for water module)
router.get('/', async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;

    let sql = `
      SELECT a.*, m.address, m.meter_number
      FROM alerts a
      JOIN meters m ON a.meter_id = m.meter_id
    `;

    if (unreadOnly === 'true') {
      sql += ' WHERE a.is_read = false';
    }

    sql += ' ORDER BY a.created_at DESC LIMIT $1';

    const result = await query(sql, [parseInt(limit)]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get unread alerts count
router.get('/unread-count', async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*) as count FROM alerts WHERE is_read = false');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark alert as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE alerts SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all alerts as read
router.patch('/read-all', async (req, res) => {
  try {
    await query('UPDATE alerts SET is_read = true WHERE is_read = false');
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Delete an alert
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM alerts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get alert statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        alert_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_read = false) as unread_count,
        MAX(created_at) as last_alert
      FROM alerts
      GROUP BY alert_type
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get alert stats error:', error);
    res.status(500).json({ error: 'Failed to get alert stats' });
  }
});

// Create test alert
router.post('/test', async (req, res) => {
  try {
    // Get first meter
    const meterResult = await query('SELECT meter_id FROM meters LIMIT 1');
    
    if (meterResult.rows.length === 0) {
      return res.status(400).json({ error: 'No meters found. Please sync data first.' });
    }
    
    const meterId = meterResult.rows[0].meter_id;
    
    const alertTypes = [
      { type: 'sudden_spike', message: 'Testovací alert: Náhly skok spotreby: 0.15 m³/hod (3x viac ako normálne).' },
      { type: 'continuous_flow', message: 'Testovací alert: Voda tečie nepretržite už 20 hodín.' },
      { type: 'high_daily', message: 'Testovací alert: Dnešná spotreba 0.8 m³ je 2x vyššia ako priemer.' },
      { type: 'freezing_risk', message: 'Testovací alert: Teplota vody je 3°C. Riziko zamrznutia!' },
    ];
    
    // Pick random alert type
    const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    
    const result = await query(`
      INSERT INTO alerts (meter_id, alert_type, message, value, threshold)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [meterId, alert.type, alert.message, 0.05, 0.02]);
    
    const savedAlert = result.rows[0];
    
    // Send email notification
    const emailSent = await sendAlertEmail(savedAlert);
    
    if (emailSent) {
      await query('UPDATE alerts SET email_sent = true WHERE id = $1', [savedAlert.id]);
    }
    
    res.json({ 
      success: true, 
      alert: savedAlert,
      emailSent,
      message: emailSent 
        ? 'Testovací alert bol vytvorený a email odoslaný' 
        : 'Testovací alert bol vytvorený, ale email sa nepodarilo odoslať (skontrolujte RESEND_API_KEY)'
    });
  } catch (error) {
    console.error('Create test alert error:', error);
    res.status(500).json({ error: 'Failed to create test alert' });
  }
});

// Get all subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, is_active, created_at FROM alert_subscriptions ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

// Subscribe to alerts
router.post('/subscriptions', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Check if already exists
    const existing = await query(
      'SELECT id, is_active FROM alert_subscriptions WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      // Reactivate if inactive
      if (!existing.rows[0].is_active) {
        await query(
          'UPDATE alert_subscriptions SET is_active = true WHERE id = $1',
          [existing.rows[0].id]
        );
        return res.json({ success: true, message: 'Subscription reactivated' });
      }
      return res.status(400).json({ error: 'Email is already subscribed' });
    }

    const result = await query(
      'INSERT INTO alert_subscriptions (email) VALUES ($1) RETURNING *',
      [email.toLowerCase()]
    );

    res.json({ success: true, subscription: result.rows[0] });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from alerts
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM alert_subscriptions WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
