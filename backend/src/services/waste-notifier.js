import { Resend } from 'resend';
import { config } from '../config.js';
import { query } from '../db.js';

let resend = null;

function getResend() {
  if (!resend && config.resendApiKey) {
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

async function getSubscribers() {
  const result = await query(
    'SELECT email FROM alert_subscriptions WHERE is_active = true'
  );
  return result.rows.map(r => r.email);
}

export const WASTE_LABELS = {
  komunal: 'Komunálny odpad',
  plast: 'Plasty',
  papier: 'Papier',
};

export const WASTE_COLORS = {
  komunal: '#374151',
  plast: '#eab308',
  papier: '#3b82f6',
};

export const WASTE_EMOJI = {
  komunal: '🗑️',
  plast: '♻️',
  papier: '📄',
};

/**
 * Check for pickups happening tomorrow and send notification emails
 * Should be called daily by cron (ideally in the evening)
 * @param {boolean} force - If true, always send notification even if already sent (for manual checks)
 */
export async function checkWastePickups(force = false) {
  console.log('Checking waste pickups for tomorrow...', force ? '(forced)' : '');
  
  try {
    // Find all pickups for tomorrow
    // If force=true (manual check), ignore notification_sent flag
    // If force=false (cron), only get pickups that haven't been notified yet
    const result = await query(`
      SELECT * FROM waste_pickups 
      WHERE pickup_date = CURRENT_DATE + 1
        ${force ? '' : 'AND notification_sent = false'}
      ORDER BY waste_type
    `);
    
    if (result.rows.length === 0) {
      console.log('No waste pickups for tomorrow');
      return { checked: true, pickups: 0, notified: false, alert: null };
    }
    
    console.log(`Found ${result.rows.length} pickups for tomorrow:`, 
      result.rows.map(r => r.waste_type));
    
    // Create alert in database
    const types = result.rows.map(r => r.waste_type);
    const typeLabels = types.map(t => WASTE_LABELS[t] || t);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const message = `Zajtra (${tomorrow.toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' })}) prebehne vývoz: ${typeLabels.join(', ')}.`;
    
    const alertResult = await query(`
      INSERT INTO waste_alerts (alert_type, waste_type, message, pickup_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, ['pickup_reminder', types.join(','), message, tomorrow.toISOString().split('T')[0]]);
    
    const savedAlert = alertResult.rows[0];
    
    // Send notification email
    const emailSent = await sendWasteNotificationEmail(result.rows);
    
    if (emailSent) {
      // Mark pickups as notified (only if not forced - cron should mark them)
      if (!force) {
        const ids = result.rows.map(r => r.id);
        await query(
          'UPDATE waste_pickups SET notification_sent = true WHERE id = ANY($1)',
          [ids]
        );
        console.log('Marked pickups as notified:', ids);
      }
      // Mark alert as email sent
      await query('UPDATE waste_alerts SET email_sent = true WHERE id = $1', [savedAlert.id]);
    }
    
    return {
      checked: true,
      pickups: result.rows.length,
      notified: emailSent,
      types: types,
      alert: savedAlert,
    };
  } catch (error) {
    console.error('Error checking waste pickups:', error);
    return { checked: false, error: error.message };
  }
}

/**
 * Send email notification about tomorrow's waste pickups
 */
async function sendWasteNotificationEmail(pickups) {
  const client = getResend();
  
  if (!client) {
    console.warn('⚠️ RESEND_API_KEY is not set - waste notification email cannot be sent');
    return false;
  }
  
  const subscribers = await getSubscribers();
  
  if (subscribers.length === 0) {
    console.warn('No subscribers for waste notification');
    return false;
  }
  
  const types = pickups.map(p => p.waste_type);
  const typeLabels = types.map(t => WASTE_LABELS[t] || t);
  const emoji = types.map(t => WASTE_EMOJI[t] || '🗑️').join(' ');
  
  const subject = `${emoji} Zajtra vývoz: ${typeLabels.join(', ')}`;
  
  // Build pickup cards
  let pickupCards = '';
  for (const pickup of pickups) {
    const label = WASTE_LABELS[pickup.waste_type] || pickup.waste_type;
    const color = WASTE_COLORS[pickup.waste_type] || '#374151';
    const icon = WASTE_EMOJI[pickup.waste_type] || '🗑️';
    
    pickupCards += `
      <div style="background: ${color}10; border-left: 4px solid ${color}; border-radius: 8px; padding: 16px; margin: 12px 0;">
        <h3 style="margin: 0 0 8px 0; color: ${color};">
          ${icon} ${label}
        </h3>
        ${pickup.notes ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">${pickup.notes}</p>` : ''}
      </div>
    `;
  }
  
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const formattedDate = tomorrowDate.toLocaleDateString('sk-SK', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">🚛 Pripomienka vývozu odpadu</h2>
      
      <p style="color: #4b5563; font-size: 16px;">
        Zajtra <strong>${formattedDate}</strong> prebehne vývoz odpadu:
      </p>
      
      ${pickupCards}
      
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400e;">
          ⚠️ <strong>Nezabudnite pripraviť nádoby večer pred vývozom!</strong>
        </p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        Tento email bol automaticky vygenerovaný systémom Staré Hory Monitor.
      </p>
    </div>
  `;
  
  try {
    console.log(`Sending waste notification to ${subscribers.length} subscribers`);
    
    const result = await client.emails.send({
      from: 'Staré Hory Monitor <onboarding@resend.dev>',
      to: subscribers,
      subject,
      html,
    });
    
    console.log('Waste notification email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send waste notification email:', error);
    return false;
  }
}

/**
 * Get upcoming pickups summary for API response
 */
export async function getUpcomingPickupsSummary() {
  const result = await query(`
    SELECT 
      waste_type,
      pickup_date,
      notes
    FROM waste_pickups 
    WHERE pickup_date >= CURRENT_DATE 
      AND pickup_date <= CURRENT_DATE + 7
    ORDER BY pickup_date ASC
  `);
  
  return result.rows;
}

// ============ WASTE ALERTS CRUD ============

/**
 * Get waste alerts from database
 */
export async function getWasteAlerts(limit = 50) {
  const result = await query(`
    SELECT * FROM waste_alerts
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

/**
 * Get unread waste alerts count
 */
export async function getUnreadWasteAlertsCount() {
  const result = await query(`
    SELECT COUNT(*) as count FROM waste_alerts WHERE is_read = false
  `);
  
  return parseInt(result.rows[0].count);
}

/**
 * Mark waste alert as read
 */
export async function markWasteAlertRead(id) {
  await query('UPDATE waste_alerts SET is_read = true WHERE id = $1', [id]);
}

/**
 * Mark all waste alerts as read
 */
export async function markAllWasteAlertsRead() {
  await query('UPDATE waste_alerts SET is_read = true WHERE is_read = false');
}

/**
 * Delete waste alert
 */
export async function deleteWasteAlert(id) {
  await query('DELETE FROM waste_alerts WHERE id = $1', [id]);
}

/**
 * Create a test waste alert for testing email delivery
 */
export async function createTestWasteAlert() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const testTypes = ['komunal', 'plast'];
  const typeLabels = testTypes.map(t => WASTE_LABELS[t]);
  
  const message = `[TEST] Zajtra (${tomorrow.toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' })}) prebehne vývoz: ${typeLabels.join(', ')}.`;
  
  // Save to database
  const result = await query(`
    INSERT INTO waste_alerts (alert_type, waste_type, message, pickup_date)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, ['pickup_reminder', testTypes.join(','), message, tomorrow.toISOString().split('T')[0]]);

  const savedAlert = result.rows[0];

  // Build fake pickups for email
  const fakePickups = testTypes.map(type => ({
    waste_type: type,
    pickup_date: tomorrow.toISOString().split('T')[0],
    notes: 'Testovací vývoz',
  }));

  // Send email
  const emailSent = await sendWasteNotificationEmail(fakePickups);

  // Update email_sent status
  if (emailSent) {
    await query('UPDATE waste_alerts SET email_sent = true WHERE id = $1', [savedAlert.id]);
  }

  return { ...savedAlert, email_sent: emailSent };
}
