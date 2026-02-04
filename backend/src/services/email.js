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

export async function sendSnowAlertEmail(alert, analysis) {
  const client = getResend();
  
  if (!client) {
    console.warn('⚠️ RESEND_API_KEY is not set - snow email cannot be sent');
    return false;
  }

  const subject = `❄️ Sneh Alert: Zajtra má nasnežiť ${alert.snowfall_cm}cm`;
  
  // Build forecast table for next days
  let forecastRows = '';
  if (analysis?.forecast) {
    for (let i = 1; i < Math.min(analysis.forecast.dates.length, 6); i++) {
      const date = new Date(analysis.forecast.dates[i]);
      const dayName = date.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' });
      const snow = analysis.forecast.snowfall[i] || 0;
      const tempMax = analysis.forecast.tempMax[i];
      const tempMin = analysis.forecast.tempMin[i];
      const isFreezing = tempMax <= 0;
      
      forecastRows += `
        <tr style="${i === 1 ? 'background: #dbeafe;' : ''}">
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dayName}${i === 1 ? ' (zajtra)' : ''}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${snow > 0 ? `${snow}cm ❄️` : '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; ${isFreezing ? 'color: #1d4ed8; font-weight: bold;' : ''}">${tempMin}° / ${tempMax}°C</td>
        </tr>
      `;
    }
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1d4ed8;">❄️ Upozornenie na sneženie</h2>
      
      <div style="background: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #1e40af;">
          Zajtra má nasnežiť ${alert.snowfall_cm}cm snehu!
        </h3>
        <p style="margin: 0; color: #1e3a8a;">${alert.message}</p>
      </div>
      
      <h4 style="color: #374151; margin-bottom: 8px;">Predpoveď na najbližšie dni:</h4>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Deň</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #d1d5db;">Sneh</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #d1d5db;">Teplota</th>
          </tr>
        </thead>
        <tbody>
          ${forecastRows}
        </tbody>
      </table>
      
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e; font-weight: bold;">
          ⚠️ Nasledujúce ${alert.freezing_days} dni bude mráz - sneh sa neroztopí!
        </p>
        <p style="margin: 8px 0 0 0; color: #92400e;">
          Pripravte sa na odpratanie snehu zo striech a chodníkov.
        </p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        Tento email bol automaticky vygenerovaný systémom Staré Hory Monitor.
      </p>
    </div>
  `;

  try {
    const subscribers = await getSubscribers();
    
    if (subscribers.length === 0) {
      console.warn('No subscribers to send snow alert email to');
      return false;
    }

    console.log(`Sending snow alert email to ${subscribers.length} subscribers`);

    const result = await client.emails.send({
      from: 'Staré Hory Monitor <onboarding@resend.dev>',
      to: subscribers,
      subject,
      html,
    });
    
    console.log('Snow alert email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send snow alert email:', error);
    return false;
  }
}

export async function sendAlertEmail(alert) {
  const client = getResend();
  
  if (!client) {
    console.warn('⚠️ RESEND_API_KEY is not set - email cannot be sent');
    console.warn('  Set RESEND_API_KEY in your .env file to enable email notifications');
    console.warn('  Alert that would be sent:', { type: alert.alert_type });
    return false;
  }

  const alertTypeLabels = {
    night_consumption: '🌙 Nočná spotreba',
    sudden_spike: '📈 Náhly skok spotreby',
    continuous_flow: '🚰 Nepretržitý prietok',
    high_daily: '📊 Vysoká denná spotreba',
    freezing_risk: '🥶 Riziko zamrznutia',
  };

  const subject = `⚠️ Water Alert: ${alertTypeLabels[alert.alert_type] || alert.alert_type}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⚠️ Water Meter Alert</h2>
      
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #991b1b;">
          ${alertTypeLabels[alert.alert_type] || alert.alert_type}
        </h3>
        <p style="margin: 0; color: #7f1d1d;">${alert.message}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Hodnota:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${alert.value != null ? Number(alert.value).toFixed(4) : 'N/A'} m³</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Threshold:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.threshold != null ? Number(alert.threshold).toFixed(4) : 'N/A'} m³</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Čas:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(alert.created_at).toLocaleString('sk-SK')}</td>
        </tr>
      </table>
      
      <p style="color: #6b7280; font-size: 14px;">
        Skontrolujte prosím váš vodomer a potrubie. Ak je všetko v poriadku, môžete tento alert ignorovať.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        Tento email bol automaticky vygenerovaný systémom Water Meter Monitor.
      </p>
    </div>
  `;

  try {
    // Get all subscribers from database
    const subscribers = await getSubscribers();
    
    if (subscribers.length === 0) {
      console.warn('No subscribers to send alert email to - add emails via Notifikácie in UI');
      return false;
    }

    console.log(`Sending alert email to ${subscribers.length} subscribers:`, subscribers);

    const result = await client.emails.send({
      from: 'Water Monitor <onboarding@resend.dev>',
      to: subscribers,
      subject,
      html,
    });
    
    console.log('Alert email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return false;
  }
}
