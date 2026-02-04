import { query } from '../db.js';
import { sendSnowAlertEmail } from './email.js';

// Thresholds for snow alerts
const THRESHOLDS = {
  snowfallCm: 2,      // minimum snowfall to trigger alert (cm)
  freezingDays: 2,    // minimum days below 0°C after snowfall
  freezingTempMax: 0, // max temperature to consider as freezing (°C)
};

// Static location: Sivice 276, Czech Republic
const LOCATION = {
  name: 'Sivice 276',
  lat: 49.2167,
  lon: 16.8333,
};

/**
 * Check snow forecast and create alert if conditions are met
 * Logic:
 * 1. Fetch 7-day forecast from Open-Meteo
 * 2. Check if tomorrow has significant snowfall (>2cm)
 * 3. Check if following days have freezing temps (snow won't melt)
 * 4. If both conditions met -> create alert and send email
 */
export async function checkSnowForecast() {
  try {
    const lat = LOCATION.lat;
    const lon = LOCATION.lon;

    // Fetch forecast from Open-Meteo
    const forecast = await fetchForecast(lat, lon);
    
    if (!forecast) {
      return { checked: false, reason: 'Failed to fetch forecast' };
    }

    // Analyze forecast
    const analysis = analyzeForecast(forecast);
    
    console.log('Snow forecast analysis:', analysis);

    // Check if alert should be created
    if (analysis.shouldAlert) {
      const alert = await createSnowAlert(analysis);
      return {
        checked: true,
        alert: alert,
        analysis: analysis,
      };
    }

    return {
      checked: true,
      alert: null,
      analysis: analysis,
    };
  } catch (error) {
    console.error('Snow forecast check error:', error);
    return { checked: false, error: error.message };
  }
}

/**
 * Fetch 7-day forecast from Open-Meteo API
 */
async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Open-Meteo API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch forecast:', error);
    return null;
  }
}

/**
 * Analyze forecast data
 * Returns analysis object with shouldAlert flag
 */
function analyzeForecast(forecast) {
  const daily = forecast.daily;
  
  if (!daily || !daily.time || daily.time.length < 3) {
    return { shouldAlert: false, reason: 'Nedostatočné dáta predpovede' };
  }

  // Tomorrow is index 1 (today is index 0)
  const tomorrowIndex = 1;
  const tomorrowDate = daily.time[tomorrowIndex];
  const tomorrowSnowfall = daily.snowfall_sum[tomorrowIndex] || 0;
  const tomorrowTempMax = daily.temperature_2m_max[tomorrowIndex];
  const tomorrowTempMin = daily.temperature_2m_min[tomorrowIndex];

  // Check snowfall threshold
  if (tomorrowSnowfall < THRESHOLDS.snowfallCm) {
    return {
      shouldAlert: false,
      reason: `Zajtrajšie sneženie (${tomorrowSnowfall}cm) pod prahom (${THRESHOLDS.snowfallCm}cm)`,
      tomorrowSnowfall,
      tomorrowDate,
    };
  }

  // Count freezing days after tomorrow (indices 2-6)
  let freezingDays = 0;
  const freezingDaysDetails = [];
  
  for (let i = 2; i < Math.min(daily.time.length, 7); i++) {
    const maxTemp = daily.temperature_2m_max[i];
    if (maxTemp <= THRESHOLDS.freezingTempMax) {
      freezingDays++;
      freezingDaysDetails.push({
        date: daily.time[i],
        maxTemp: maxTemp,
        minTemp: daily.temperature_2m_min[i],
      });
    }
  }

  // Check freezing days threshold
  if (freezingDays < THRESHOLDS.freezingDays) {
    return {
      shouldAlert: false,
      reason: `Len ${freezingDays} mrazivých dní po snežení (treba min. ${THRESHOLDS.freezingDays})`,
      tomorrowSnowfall,
      tomorrowDate,
      freezingDays,
    };
  }

  // All conditions met - should alert!
  return {
    shouldAlert: true,
    tomorrowDate,
    tomorrowSnowfall,
    tomorrowTempMax,
    tomorrowTempMin,
    freezingDays,
    freezingDaysDetails,
    forecast: {
      dates: daily.time,
      snowfall: daily.snowfall_sum,
      tempMax: daily.temperature_2m_max,
      tempMin: daily.temperature_2m_min,
    },
  };
}

/**
 * Create snow alert and send email
 */
async function createSnowAlert(analysis) {
  const message = buildAlertMessage(analysis);
  
  // Save to database
  const result = await query(`
    INSERT INTO snow_alerts (alert_type, message, snowfall_cm, freezing_days, snow_date)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    'snow_warning',
    message,
    analysis.tomorrowSnowfall,
    analysis.freezingDays,
    analysis.tomorrowDate,
  ]);

  const savedAlert = result.rows[0];

  // Send email
  const emailSent = await sendSnowAlertEmail(savedAlert, analysis);

  // Update email_sent status
  if (emailSent) {
    await query('UPDATE snow_alerts SET email_sent = true WHERE id = $1', [savedAlert.id]);
  }

  return savedAlert;
}

/**
 * Build human-readable alert message
 */
function buildAlertMessage(analysis) {
  const date = new Date(analysis.tomorrowDate);
  const formattedDate = date.toLocaleDateString('sk-SK', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  
  return `Zajtra (${formattedDate}) má nasnežiť ${analysis.tomorrowSnowfall}cm snehu. ` +
    `Nasledujúce ${analysis.freezingDays} dni bude mráz - sneh sa neroztopí. ` +
    `Pripravte sa na odpratanie snehu!`;
}

/**
 * Get current forecast for UI display
 */
export async function getSnowForecast() {
  try {
    const lat = LOCATION.lat;
    const lon = LOCATION.lon;

    const forecast = await fetchForecast(lat, lon);
    
    if (!forecast) {
      return { available: false, reason: 'Failed to fetch forecast' };
    }

    const analysis = analyzeForecast(forecast);

    return {
      available: true,
      location: { name: LOCATION.name, lat, lon },
      forecast: forecast.daily,
      analysis: analysis,
    };
  } catch (error) {
    console.error('Get forecast error:', error);
    return { available: false, error: error.message };
  }
}

/**
 * Get snow alerts from database
 */
export async function getSnowAlerts(limit = 50) {
  const result = await query(`
    SELECT * FROM snow_alerts
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

/**
 * Get unread snow alerts count
 */
export async function getUnreadSnowAlertsCount() {
  const result = await query(`
    SELECT COUNT(*) as count FROM snow_alerts WHERE is_read = false
  `);
  
  return parseInt(result.rows[0].count);
}

/**
 * Mark snow alert as read
 */
export async function markSnowAlertRead(id) {
  await query('UPDATE snow_alerts SET is_read = true WHERE id = $1', [id]);
}

/**
 * Mark all snow alerts as read
 */
export async function markAllSnowAlertsRead() {
  await query('UPDATE snow_alerts SET is_read = true WHERE is_read = false');
}

/**
 * Delete snow alert
 */
export async function deleteSnowAlert(id) {
  await query('DELETE FROM snow_alerts WHERE id = $1', [id]);
}

/**
 * Create a test snow alert for testing email delivery
 */
export async function createTestSnowAlert() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const testAnalysis = {
    tomorrowDate: tomorrow.toISOString().split('T')[0],
    tomorrowSnowfall: 15,
    tomorrowTempMax: -3,
    tomorrowTempMin: -8,
    freezingDays: 4,
    freezingDaysDetails: [],
    forecast: {
      dates: Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      }),
      snowfall: [0, 15, 2, 0, 0, 0, 0],
      tempMax: [2, -3, -5, -4, -2, 1, 3],
      tempMin: [-2, -8, -10, -9, -7, -4, -1],
    },
  };

  const message = `[TEST] Zajtra má nasnežiť 15cm snehu. Nasledujúce 4 dni bude mráz - sneh sa neroztopí. Pripravte sa na odpratanie snehu!`;
  
  // Save to database
  const result = await query(`
    INSERT INTO snow_alerts (alert_type, message, snowfall_cm, freezing_days, snow_date)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, ['snow_warning', message, 15, 4, tomorrow.toISOString().split('T')[0]]);

  const savedAlert = result.rows[0];

  // Send email
  const { sendSnowAlertEmail } = await import('./email.js');
  const emailSent = await sendSnowAlertEmail(savedAlert, testAnalysis);

  // Update email_sent status
  if (emailSent) {
    await query('UPDATE snow_alerts SET email_sent = true WHERE id = $1', [savedAlert.id]);
  }

  return { ...savedAlert, email_sent: emailSent };
}
