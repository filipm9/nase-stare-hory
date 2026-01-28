import { Router } from 'express';
import { query } from '../db.js';
import { syncAll, syncHistorical, syncMeters } from '../services/sync.js';
import { detectLeaks } from '../services/leak-detector.js';

const router = Router();

// Get all meters
router.get('/meters', async (req, res) => {
  try {
    const result = await query(`
      SELECT m.*, 
        (SELECT state FROM readings WHERE meter_id = m.meter_id ORDER BY reading_date DESC LIMIT 1) as latest_state,
        (SELECT reading_date FROM readings WHERE meter_id = m.meter_id ORDER BY reading_date DESC LIMIT 1) as latest_reading
      FROM meters m
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get meters error:', error);
    res.status(500).json({ error: 'Failed to get meters' });
  }
});

// Get readings for a meter
router.get('/meters/:meterId/readings', async (req, res) => {
  try {
    const { meterId } = req.params;
    const { from, to, aggregation } = req.query;

    let dateFilter = '';
    const params = [meterId];

    if (from) {
      params.push(from);
      dateFilter += ` AND reading_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      dateFilter += ` AND reading_date <= $${params.length}`;
    }

    let sql;
    
    if (aggregation === 'daily') {
      sql = `
        SELECT 
          DATE(reading_date) as date,
          MIN(state) as min_state,
          MAX(state) as max_state,
          MAX(state) - MIN(state) as consumption,
          AVG(heat) as avg_heat,
          COUNT(*) as readings_count
        FROM readings
        WHERE meter_id = $1 ${dateFilter}
        GROUP BY DATE(reading_date)
        ORDER BY date DESC
      `;
    } else if (aggregation === 'hourly') {
      sql = `
        SELECT 
          DATE_TRUNC('hour', reading_date) as date,
          MIN(state) as min_state,
          MAX(state) as max_state,
          MAX(state) - MIN(state) as consumption,
          AVG(heat) as avg_heat
        FROM readings
        WHERE meter_id = $1 ${dateFilter}
        GROUP BY DATE_TRUNC('hour', reading_date)
        ORDER BY date DESC
      `;
    } else {
      sql = `
        SELECT 
          id, reading_date, state, heat,
          state - LAG(state) OVER (ORDER BY reading_date) as consumption
        FROM readings
        WHERE meter_id = $1 ${dateFilter}
        ORDER BY reading_date DESC
        LIMIT 1000
      `;
    }

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get readings error:', error);
    res.status(500).json({ error: 'Failed to get readings' });
  }
});

// Get consumption statistics
router.get('/meters/:meterId/stats', async (req, res) => {
  try {
    const { meterId } = req.params;

    const result = await query(`
      WITH daily AS (
        SELECT 
          DATE(reading_date) as day,
          MAX(state) - MIN(state) as consumption
        FROM readings
        WHERE meter_id = $1
        GROUP BY DATE(reading_date)
      ),
      hourly AS (
        SELECT 
          reading_date,
          state - LAG(state) OVER (ORDER BY reading_date) as consumption
        FROM readings
        WHERE meter_id = $1
          AND reading_date > NOW() - INTERVAL '24 hours'
      )
      SELECT 
        (SELECT SUM(consumption) FROM daily WHERE day >= CURRENT_DATE - INTERVAL '7 days') as week_consumption,
        (SELECT SUM(consumption) FROM daily WHERE day >= CURRENT_DATE - INTERVAL '30 days') as month_consumption,
        (SELECT AVG(consumption) FROM daily WHERE day >= CURRENT_DATE - INTERVAL '30 days') as avg_daily,
        (SELECT MAX(consumption) FROM hourly) as max_hourly_today,
        (SELECT MIN(state) FROM readings WHERE meter_id = $1) as first_reading,
        (SELECT MAX(state) FROM readings WHERE meter_id = $1) as last_reading,
        (SELECT COUNT(*) FROM readings WHERE meter_id = $1) as total_readings
    `, [meterId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Sync data from VAS API (manual trigger)
router.post('/sync', async (req, res) => {
  try {
    const result = await syncAll();
    res.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// Sync historical data
router.post('/sync/historical', async (req, res) => {
  const { days = 90 } = req.body;
  
  // Create sync log entry
  const logResult = await query(
    'INSERT INTO sync_log (sync_type, status) VALUES ($1, $2) RETURNING id',
    [`historical_${days}d`, 'running']
  );
  const logId = logResult.rows[0].id;
  
  try {
    // First ensure meters are synced
    await syncMeters();
    
    const meters = await query('SELECT meter_id FROM meters');
    
    let totalRecords = 0;
    for (const meter of meters.rows) {
      const count = await syncHistorical(meter.meter_id, days);
      totalRecords += count;
    }
    
    // Update log as success
    await query(
      'UPDATE sync_log SET status = $1, records_synced = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['success', totalRecords, logId]
    );
    
    res.json({ success: true, recordsSynced: totalRecords });
  } catch (error) {
    console.error('Historical sync error:', error);
    
    // Update log as error
    await query(
      'UPDATE sync_log SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['error', error.message, logId]
    );
    
    res.status(500).json({ error: 'Historical sync failed', message: error.message });
  }
});

// Run leak detection manually
router.post('/detect-leaks', async (req, res) => {
  try {
    const meters = await query('SELECT meter_id, address, meter_number FROM meters');
    const allAlerts = [];
    const checksPerformed = [];
    
    for (const meter of meters.rows) {
      // Get detection details
      const details = await getDetectionDetails(meter.meter_id);
      checksPerformed.push({
        meter: meter.address || `Vodomer ${meter.meter_number}`,
        meterId: meter.meter_id,
        checks: details,
      });
      
      const alerts = await detectLeaks(meter.meter_id);
      allAlerts.push(...alerts);
    }
    
    res.json({ 
      alerts: allAlerts,
      checksPerformed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Leak detection error:', error);
    res.status(500).json({ error: 'Leak detection failed', message: error.message });
  }
});

// Helper to get detection details for insight
async function getDetectionDetails(meterId) {
  const checks = [];
  
  // Night consumption check
  const nightResult = await query(`
    WITH hourly AS (
      SELECT 
        reading_date,
        state,
        state - LAG(state) OVER (ORDER BY reading_date) as consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '24 hours'
      ORDER BY reading_date
    )
    SELECT 
      MAX(consumption) as max_consumption,
      AVG(consumption) as avg_consumption,
      COUNT(*) as reading_count
    FROM hourly
    WHERE EXTRACT(HOUR FROM reading_date) BETWEEN 2 AND 5
      AND consumption IS NOT NULL
  `, [meterId]);
  
  const nightReadings = parseInt(nightResult.rows[0]?.reading_count || 0);
  const nightMax = parseFloat(nightResult.rows[0]?.max_consumption || 0);
  
  checks.push({
    name: 'Nočná spotreba (2-5h)',
    description: 'Kontrola spotreby v nočných hodinách (toleruje WC, pitie)',
    threshold: '0.05 m³/hod (50 litrov)',
    currentValue: nightReadings > 0 
      ? `${nightMax.toFixed(4)} m³/hod` 
      : 'Žiadne dáta v nočných hodinách',
    status: nightMax > 0.05 ? 'warning' : 'ok',
  });
  
  // Sudden spike check - get average from 7 days
  const spikeResult = await query(`
    WITH hourly AS (
      SELECT 
        reading_date,
        state - LAG(state) OVER (ORDER BY reading_date) as consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '7 days'
      ORDER BY reading_date
    )
    SELECT 
      AVG(consumption) as avg_consumption
    FROM hourly
    WHERE consumption > 0
  `, [meterId]);
  
  // Get recent consumption by comparing last 2 readings (not limited to 2 hour window)
  const recentResult = await query(`
    WITH recent_readings AS (
      SELECT state, reading_date
      FROM readings
      WHERE meter_id = $1
      ORDER BY reading_date DESC
      LIMIT 2
    )
    SELECT 
      (SELECT state FROM recent_readings ORDER BY reading_date DESC LIMIT 1) -
      (SELECT state FROM recent_readings ORDER BY reading_date ASC LIMIT 1) as consumption,
      (SELECT reading_date FROM recent_readings ORDER BY reading_date DESC LIMIT 1) as last_reading
  `, [meterId]);
  
  const avgConsumption = parseFloat(spikeResult.rows[0]?.avg_consumption || 0);
  const recentConsumption = parseFloat(recentResult.rows[0]?.consumption || 0);
  const lastReading = recentResult.rows[0]?.last_reading;
  
  checks.push({
    name: 'Náhly skok spotreby',
    description: 'Porovnanie aktuálnej spotreby s 7-dňovým priemerom',
    threshold: `${(avgConsumption * 2.5).toFixed(4)} m³/hod (2.5× priemer)`,
    currentValue: lastReading 
      ? `${recentConsumption.toFixed(4)} m³/hod` 
      : 'Žiadne dáta',
    avgValue: `Priemer: ${avgConsumption.toFixed(4)} m³/hod`,
    status: avgConsumption > 0 && recentConsumption > avgConsumption * 2.5 ? 'warning' : 'ok',
  });
  
  // Continuous flow check
  const flowResult = await query(`
    WITH hourly AS (
      SELECT 
        reading_date,
        state - LAG(state) OVER (ORDER BY reading_date) as consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '24 hours'
      ORDER BY reading_date
    )
    SELECT 
      COUNT(*) FILTER (WHERE consumption >= 0.005) as flow_hours,
      COUNT(*) as total_hours
    FROM hourly
    WHERE consumption IS NOT NULL
  `, [meterId]);
  
  const flowHours = parseInt(flowResult.rows[0]?.flow_hours || 0);
  const totalHours = parseInt(flowResult.rows[0]?.total_hours || 0);
  
  checks.push({
    name: 'Nepretržitý prietok',
    description: 'Kontrola či voda tečie nepretržite (únik)',
    threshold: '23 hodín nepretržitého prietoku',
    currentValue: `${flowHours}/${totalHours} hodín s prietokom`,
    status: flowHours >= 23 ? 'warning' : 'ok',
  });
  
  // High daily consumption
  const dailyResult = await query(`
    WITH daily AS (
      SELECT 
        DATE(reading_date) as day,
        MAX(state) - MIN(state) as daily_consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '30 days'
      GROUP BY DATE(reading_date)
    )
    SELECT 
      (SELECT daily_consumption FROM daily WHERE day = CURRENT_DATE) as today,
      AVG(daily_consumption) as avg_daily
    FROM daily
    WHERE day < CURRENT_DATE
  `, [meterId]);
  
  const todayConsumption = parseFloat(dailyResult.rows[0]?.today || 0);
  const avgDaily = parseFloat(dailyResult.rows[0]?.avg_daily || 0);
  
  const dailyThreshold = avgDaily * 3.0;
  const dailyMinimum = 1.0; // m³
  const effectiveThreshold = Math.max(dailyThreshold, dailyMinimum);
  
  checks.push({
    name: 'Vysoká denná spotreba',
    description: 'Porovnanie dnešnej spotreby s mesačným priemerom',
    threshold: `${effectiveThreshold.toFixed(3)} m³ (3× priemer alebo min. 1 m³)`,
    currentValue: `Dnes: ${todayConsumption.toFixed(3)} m³`,
    avgValue: `Priemer: ${avgDaily.toFixed(3)} m³/deň`,
    status: avgDaily > 0 && todayConsumption > dailyThreshold && todayConsumption > dailyMinimum ? 'warning' : 'ok',
  });
  
  // Freezing risk - extended to 24 hours to catch less frequent temperature readings
  const tempResult = await query(`
    SELECT heat, reading_date
    FROM readings
    WHERE meter_id = $1
      AND reading_date > NOW() - INTERVAL '24 hours'
      AND heat IS NOT NULL
    ORDER BY reading_date DESC
    LIMIT 1
  `, [meterId]);
  
  const rawTemp = tempResult.rows[0]?.heat;
  const tempDate = tempResult.rows[0]?.reading_date;
  const temp = rawTemp !== null && rawTemp !== undefined ? parseFloat(rawTemp) : null;
  const hasTemp = temp !== null && !isNaN(temp);
  
  checks.push({
    name: 'Riziko zamrznutia',
    description: 'Kontrola teploty vody v potrubí (posledných 24h)',
    threshold: '< 5°C',
    currentValue: hasTemp 
      ? `${temp}°C (${new Date(tempDate).toLocaleString('sk-SK')})` 
      : 'Teplota nedostupná (žiadne dáta za 24h)',
    status: hasTemp && temp < 5 ? 'warning' : 'ok',
  });
  
  return checks;
}

// Get sync logs
router.get('/sync-logs', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM sync_log
      ORDER BY started_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sync logs error:', error);
    res.status(500).json({ error: 'Failed to get sync logs' });
  }
});

// Diagnostic: Check if temperature data exists
router.get('/diagnostics', async (req, res) => {
  try {
    const results = {};
    
    // Total readings
    const totalResult = await query('SELECT COUNT(*) as count FROM readings');
    results.totalReadings = parseInt(totalResult.rows[0].count);
    
    // Readings with temperature
    const heatResult = await query('SELECT COUNT(*) as count FROM readings WHERE heat IS NOT NULL');
    results.readingsWithTemperature = parseInt(heatResult.rows[0].count);
    
    // Sample of recent readings with heat values
    const sampleResult = await query(`
      SELECT reading_date, state, heat 
      FROM readings 
      WHERE heat IS NOT NULL 
      ORDER BY reading_date DESC 
      LIMIT 5
    `);
    results.sampleWithTemperature = sampleResult.rows;
    
    // Sample of recent readings (any)
    const recentResult = await query(`
      SELECT reading_date, state, heat 
      FROM readings 
      ORDER BY reading_date DESC 
      LIMIT 5
    `);
    results.recentReadings = recentResult.rows;
    
    // Date range
    const rangeResult = await query(`
      SELECT MIN(reading_date) as oldest, MAX(reading_date) as newest
      FROM readings
    `);
    results.dateRange = rangeResult.rows[0];
    
    res.json(results);
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({ error: 'Failed to get diagnostics' });
  }
});

export default router;
