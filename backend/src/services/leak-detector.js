import { query } from '../db.js';
import { sendAlertEmail } from './email.js';

// Thresholds - balanced to avoid false positives
const THRESHOLDS = {
  suddenSpike: 2.5,            // multiplier vs hourly average
  continuousFlowHours: 23,     // hours of non-stop flow (increased - normal home usage can be 18+)
  highDailyMultiplier: 3.0,    // multiplier vs monthly average daily (increased for hot tubs, garden watering)
  highDailyMinimum: 1.0,       // m³ - minimum daily consumption to trigger alert regardless of average
  freezingTemp: 5,             // °C - risk of pipe freezing
  minConsumptionThreshold: 0.005, // m³ - minimum to consider as "flow"
};

export async function detectLeaks(meterId) {
  const alerts = [];

  try {
    // Run all detection checks
    // Note: Night consumption check removed - water filtration regeneration runs at night

    const spikeAlert = await checkSuddenSpike(meterId);
    if (spikeAlert) alerts.push(spikeAlert);

    const flowAlert = await checkContinuousFlow(meterId);
    if (flowAlert) alerts.push(flowAlert);

    const dailyAlert = await checkHighDailyConsumption(meterId);
    if (dailyAlert) alerts.push(dailyAlert);

    const freezeAlert = await checkFreezingRisk(meterId);
    if (freezeAlert) alerts.push(freezeAlert);

    // Save and send alerts
    for (const alert of alerts) {
      await saveAndSendAlert(meterId, alert);
    }

    return alerts;
  } catch (error) {
    console.error('Leak detection error:', error);
    return [];
  }
}

async function checkSuddenSpike(meterId) {
  // Compare last hour with average
  const result = await query(`
    WITH hourly AS (
      SELECT 
        reading_date,
        state - LAG(state) OVER (ORDER BY reading_date) as consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '7 days'
      ORDER BY reading_date
    ),
    stats AS (
      SELECT 
        AVG(consumption) as avg_consumption,
        STDDEV(consumption) as std_consumption
      FROM hourly
      WHERE consumption > 0
    ),
    recent AS (
      SELECT consumption
      FROM hourly
      WHERE reading_date > NOW() - INTERVAL '2 hours'
      ORDER BY reading_date DESC
      LIMIT 1
    )
    SELECT 
      r.consumption as recent_consumption,
      s.avg_consumption,
      s.std_consumption
    FROM recent r, stats s
  `, [meterId]);

  const recent = parseFloat(result.rows[0]?.recent_consumption) || 0;
  const avg = parseFloat(result.rows[0]?.avg_consumption) || 0;

  if (avg > 0 && recent > avg * THRESHOLDS.suddenSpike) {
    return {
      type: 'sudden_spike',
      message: `Náhly skok spotreby: ${recent.toFixed(4)} m³/hod (priemer: ${avg.toFixed(4)} m³/hod). To je ${(recent/avg).toFixed(1)}x viac ako normálne.`,
      value: recent,
      threshold: avg * THRESHOLDS.suddenSpike,
    };
  }

  return null;
}

async function checkContinuousFlow(meterId) {
  // Check if water has been flowing continuously
  const result = await query(`
    WITH hourly AS (
      SELECT 
        reading_date,
        state - LAG(state) OVER (ORDER BY reading_date) as consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '24 hours'
      ORDER BY reading_date
    ),
    zero_hours AS (
      SELECT COUNT(*) as zero_count
      FROM hourly
      WHERE consumption < $2
    ),
    total_hours AS (
      SELECT COUNT(*) as total
      FROM hourly
      WHERE consumption IS NOT NULL
    )
    SELECT 
      t.total - z.zero_count as flow_hours,
      t.total as total_hours
    FROM zero_hours z, total_hours t
  `, [meterId, THRESHOLDS.minConsumptionThreshold]);

  const flowHours = parseInt(result.rows[0]?.flow_hours) || 0;

  if (flowHours >= THRESHOLDS.continuousFlowHours) {
    return {
      type: 'continuous_flow',
      message: `Voda tečie nepretržite už ${flowHours} hodín. To môže indikovať únik.`,
      value: flowHours,
      threshold: THRESHOLDS.continuousFlowHours,
    };
  }

  return null;
}

async function checkHighDailyConsumption(meterId) {
  // Compare today's consumption with monthly average
  const result = await query(`
    WITH daily AS (
      SELECT 
        DATE(reading_date) as day,
        MAX(state) - MIN(state) as daily_consumption
      FROM readings
      WHERE meter_id = $1
        AND reading_date > NOW() - INTERVAL '30 days'
      GROUP BY DATE(reading_date)
    ),
    monthly_avg AS (
      SELECT AVG(daily_consumption) as avg_daily
      FROM daily
      WHERE day < CURRENT_DATE
    ),
    today AS (
      SELECT daily_consumption
      FROM daily
      WHERE day = CURRENT_DATE
    )
    SELECT 
      t.daily_consumption as today_consumption,
      m.avg_daily
    FROM today t, monthly_avg m
  `, [meterId]);

  const today = parseFloat(result.rows[0]?.today_consumption) || 0;
  const avg = parseFloat(result.rows[0]?.avg_daily) || 0;

  // Alert only if:
  // 1. Today's consumption exceeds multiplier of average AND
  // 2. Today's consumption exceeds absolute minimum threshold
  // This prevents false alerts for hot tubs, garden watering, etc.
  const threshold = avg * THRESHOLDS.highDailyMultiplier;
  if (avg > 0 && today > threshold && today > THRESHOLDS.highDailyMinimum) {
    return {
      type: 'high_daily',
      message: `Dnešná spotreba ${today.toFixed(3)} m³ je ${(today/avg).toFixed(1)}x vyššia ako mesačný priemer (${avg.toFixed(3)} m³/deň).`,
      value: today,
      threshold: threshold,
    };
  }

  return null;
}

async function checkFreezingRisk(meterId) {
  // Check if water temperature is too low
  // Extended window to 24 hours to catch temperature data from less frequent readings
  const result = await query(`
    SELECT heat
    FROM readings
    WHERE meter_id = $1
      AND reading_date > NOW() - INTERVAL '24 hours'
      AND heat IS NOT NULL
    ORDER BY reading_date DESC
    LIMIT 1
  `, [meterId]);

  // parseFloat returns NaN if no data, so we need to check properly
  const rawTemp = result.rows[0]?.heat;
  const temp = rawTemp !== null && rawTemp !== undefined ? parseFloat(rawTemp) : null;

  if (temp !== null && !isNaN(temp) && temp < THRESHOLDS.freezingTemp) {
    return {
      type: 'freezing_risk',
      message: `Teplota vody je ${temp}°C. Riziko zamrznutia potrubia!`,
      value: temp,
      threshold: THRESHOLDS.freezingTemp,
    };
  }

  return null;
}

async function saveAndSendAlert(meterId, alert) {
  // Save to database
  const result = await query(`
    INSERT INTO alerts (meter_id, alert_type, message, value, threshold)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [meterId, alert.type, alert.message, alert.value, alert.threshold]);

  const savedAlert = result.rows[0];

  // Send email
  const emailSent = await sendAlertEmail(savedAlert);

  // Update email_sent status
  if (emailSent) {
    await query('UPDATE alerts SET email_sent = true WHERE id = $1', [savedAlert.id]);
  }

  return savedAlert;
}
