import { Router } from 'express';
import { query } from '../db.js';
import {
  checkWastePickups,
  getWasteAlerts,
  getUnreadWasteAlertsCount,
  markWasteAlertRead,
  markAllWasteAlertsRead,
  deleteWasteAlert,
  createTestWasteAlert,
} from '../services/waste-notifier.js';

const router = Router();

// Waste types with Slovak labels
const WASTE_TYPES = {
  komunal: { label: 'Komunálny odpad', color: '#374151' },
  plast: { label: 'Plast', color: '#eab308' },
  papier: { label: 'Papier', color: '#3b82f6' },
};

// Get all pickups (optionally filtered by date range)
router.get('/pickups', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    let sql = 'SELECT * FROM waste_pickups';
    const params = [];
    const conditions = [];
    
    if (from) {
      conditions.push(`pickup_date >= $${params.length + 1}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`pickup_date <= $${params.length + 1}`);
      params.push(to);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY pickup_date ASC';
    
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get pickups error:', error);
    res.status(500).json({ error: 'Failed to get pickups' });
  }
});

// Get upcoming pickups (next 30 days by default)
router.get('/pickups/upcoming', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await query(`
      SELECT * FROM waste_pickups 
      WHERE pickup_date >= CURRENT_DATE 
        AND pickup_date <= CURRENT_DATE + $1::integer
      ORDER BY pickup_date ASC
    `, [parseInt(days)]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get upcoming pickups error:', error);
    res.status(500).json({ error: 'Failed to get upcoming pickups' });
  }
});

// Get waste types metadata
router.get('/types', (req, res) => {
  res.json(WASTE_TYPES);
});

// Create single pickup
router.post('/pickups', async (req, res) => {
  try {
    const { pickup_date, waste_type, notes } = req.body;
    
    if (!pickup_date || !waste_type) {
      return res.status(400).json({ error: 'pickup_date and waste_type are required' });
    }
    
    if (!WASTE_TYPES[waste_type]) {
      return res.status(400).json({ error: 'Invalid waste_type' });
    }
    
    const result = await query(`
      INSERT INTO waste_pickups (pickup_date, waste_type, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (pickup_date, waste_type) DO UPDATE SET
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [pickup_date, waste_type, notes || null]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create pickup error:', error);
    res.status(500).json({ error: 'Failed to create pickup' });
  }
});

// Generate series of pickups
router.post('/pickups/series', async (req, res) => {
  try {
    const { 
      waste_type, 
      start_date, 
      day_of_week,  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
      period_weeks, // Every N weeks (1 = weekly, 2 = bi-weekly, etc.)
      count,        // How many entries to generate
      notes 
    } = req.body;
    
    if (!waste_type || !start_date || day_of_week === undefined || !period_weeks || !count) {
      return res.status(400).json({ 
        error: 'waste_type, start_date, day_of_week, period_weeks, and count are required' 
      });
    }
    
    if (!WASTE_TYPES[waste_type]) {
      return res.status(400).json({ error: 'Invalid waste_type' });
    }
    
    // Calculate dates
    const dates = [];
    let currentDate = new Date(start_date);
    
    // Adjust to the correct day of week if needed
    const currentDow = currentDate.getDay();
    const targetDow = parseInt(day_of_week);
    
    if (currentDow !== targetDow) {
      // Move to next occurrence of target day
      const daysUntilTarget = (targetDow - currentDow + 7) % 7;
      currentDate.setDate(currentDate.getDate() + (daysUntilTarget || 7));
    }
    
    for (let i = 0; i < count; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + (period_weeks * 7));
    }
    
    // Insert all dates
    const created = [];
    const skipped = [];
    
    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0];
      try {
        const result = await query(`
          INSERT INTO waste_pickups (pickup_date, waste_type, notes)
          VALUES ($1, $2, $3)
          ON CONFLICT (pickup_date, waste_type) DO NOTHING
          RETURNING *
        `, [dateStr, waste_type, notes || null]);
        
        if (result.rows.length > 0) {
          created.push(result.rows[0]);
        } else {
          skipped.push(dateStr);
        }
      } catch (err) {
        skipped.push(dateStr);
      }
    }
    
    res.json({ 
      created: created.length, 
      skipped: skipped.length,
      entries: created,
      skippedDates: skipped,
    });
  } catch (error) {
    console.error('Generate series error:', error);
    res.status(500).json({ error: 'Failed to generate series' });
  }
});

// Update pickup
router.patch('/pickups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pickup_date, waste_type, notes } = req.body;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (pickup_date !== undefined) {
      updates.push(`pickup_date = $${paramIndex++}`);
      params.push(pickup_date);
    }
    if (waste_type !== undefined) {
      if (!WASTE_TYPES[waste_type]) {
        return res.status(400).json({ error: 'Invalid waste_type' });
      }
      updates.push(`waste_type = $${paramIndex++}`);
      params.push(waste_type);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    
    const result = await query(`
      UPDATE waste_pickups 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pickup not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update pickup error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Pickup for this date and type already exists' });
    }
    res.status(500).json({ error: 'Failed to update pickup' });
  }
});

// Delete pickup
router.delete('/pickups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM waste_pickups WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pickup not found' });
    }
    
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Delete pickup error:', error);
    res.status(500).json({ error: 'Failed to delete pickup' });
  }
});

// Delete multiple pickups (for bulk operations)
router.post('/pickups/delete-many', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    
    const result = await query(
      'DELETE FROM waste_pickups WHERE id = ANY($1) RETURNING id',
      [ids]
    );
    
    res.json({ 
      success: true, 
      deletedCount: result.rows.length,
      deletedIds: result.rows.map(r => r.id),
    });
  } catch (error) {
    console.error('Delete many pickups error:', error);
    res.status(500).json({ error: 'Failed to delete pickups' });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        waste_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE pickup_date >= CURRENT_DATE) as upcoming,
        MIN(pickup_date) FILTER (WHERE pickup_date >= CURRENT_DATE) as next_pickup
      FROM waste_pickups
      GROUP BY waste_type
    `);
    
    // Also get the overall next pickup
    const nextResult = await query(`
      SELECT * FROM waste_pickups 
      WHERE pickup_date >= CURRENT_DATE 
      ORDER BY pickup_date ASC 
      LIMIT 1
    `);
    
    res.json({
      byType: result.rows,
      nextPickup: nextResult.rows[0] || null,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============ ALERTS ============

// Check pickups and create alert if needed (manual trigger)
// force=true means always send notification even if already sent today
router.post('/check', async (req, res) => {
  try {
    const result = await checkWastePickups(true); // force=true for manual checks
    res.json(result);
  } catch (error) {
    console.error('Waste check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get waste alerts
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await getWasteAlerts(limit);
    res.json(alerts);
  } catch (error) {
    console.error('Get waste alerts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/alerts/unread-count', async (req, res) => {
  try {
    const count = await getUnreadWasteAlertsCount();
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark alert as read
router.patch('/alerts/:id/read', async (req, res) => {
  try {
    await markWasteAlertRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all alerts as read
router.patch('/alerts/read-all', async (req, res) => {
  try {
    await markAllWasteAlertsRead();
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create test alert
router.post('/alerts/test', async (req, res) => {
  try {
    const alert = await createTestWasteAlert();
    res.json(alert);
  } catch (error) {
    console.error('Create test alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete alert
router.delete('/alerts/:id', async (req, res) => {
  try {
    await deleteWasteAlert(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
