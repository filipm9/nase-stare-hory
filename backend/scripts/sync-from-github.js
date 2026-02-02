/**
 * Standalone sync script for GitHub Actions
 * 
 * Usage: node scripts/sync-from-github.js [days]
 * 
 * Environment variables required:
 * - DATABASE_URL
 * - VAS_API_URL
 * - VAS_USERNAME
 * - VAS_PASSWORD
 * - VAS_CLIENT_ID
 * - VAS_CLIENT_SECRET
 */

import { pool, runMigrations, query } from '../src/db.js';
import * as vasApi from '../src/services/vas-api.js';
import { detectLeaks } from '../src/services/leak-detector.js';

const days = parseInt(process.argv[2] || '7', 10);

async function syncMeters() {
  console.log('Syncing meters...');
  const customerData = await vasApi.getCustomerData();
  
  let count = 0;
  for (const cp of customerData) {
    for (const meter of cp.INSTALLED_METERS || []) {
      await query(`
        INSERT INTO meters (meter_id, meter_number, cp_id, address, gps, installed_from, radio_number, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (meter_id) DO UPDATE SET
          meter_number = EXCLUDED.meter_number,
          cp_id = EXCLUDED.cp_id,
          address = EXCLUDED.address,
          gps = EXCLUDED.gps,
          installed_from = EXCLUDED.installed_from,
          radio_number = EXCLUDED.radio_number,
          updated_at = CURRENT_TIMESTAMP
      `, [
        meter.METER_ID,
        meter.METER_NUMBER,
        cp.CP_ID,
        formatAddress(cp.CP_ADRESS),
        cp.CP_ADRESS?.GPS,
        meter.METER_DATE_FROM,
        meter.RADIO_NUMBER,
      ]);
      count++;
    }
  }
  console.log(`Synced ${count} meters`);
  return count;
}

async function syncReadings(meterId, daysBack) {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);
  
  console.log(`Syncing readings for meter ${meterId}: ${dateFrom.toISOString().split('T')[0]} to ${dateTo.toISOString().split('T')[0]}`);
  
  const readings = await vasApi.getProfileData(meterId, dateFrom, dateTo);
  
  let insertedCount = 0;
  for (const reading of readings) {
    try {
      const result = await query(`
        INSERT INTO readings (meter_id, reading_date, state, heat)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (meter_id, reading_date) DO NOTHING
        RETURNING id
      `, [
        meterId,
        reading.DATE,
        reading.STATE,
        reading.HEAT,
      ]);
      if (result.rowCount > 0) insertedCount++;
    } catch (err) {
      // Ignore duplicates
    }
  }
  
  console.log(`Inserted ${insertedCount} readings for meter ${meterId}`);
  return insertedCount;
}

function formatAddress(addr) {
  if (!addr) return null;
  const parts = [addr.STREET, addr.HOUSENUM, addr.STREETNUM, addr.CITY].filter(Boolean);
  return parts.join(' ') || `${addr.CITY} ${addr.HOUSENUM}`;
}

async function main() {
  console.log(`Starting sync from GitHub Actions (${days} days back)`);
  console.log(`VAS API URL: ${process.env.VAS_API_URL}`);
  console.log(`Database: ${process.env.DATABASE_URL?.substring(0, 30)}...`);
  
  try {
    // Ensure database tables exist
    await runMigrations();
    
    // Log start
    const logResult = await query(
      'INSERT INTO sync_log (sync_type, status) VALUES ($1, $2) RETURNING id',
      [`github_${days}d`, 'running']
    );
    const logId = logResult.rows[0].id;
    
    // Sync meters first
    await syncMeters();
    
    // Get all meters
    const meters = await query('SELECT meter_id FROM meters');
    console.log(`Found ${meters.rows.length} meters`);
    
    // Sync readings for each meter
    let totalRecords = 0;
    for (const meter of meters.rows) {
      try {
        const count = await syncReadings(meter.meter_id, days);
        totalRecords += count;
      } catch (err) {
        console.error(`Error syncing meter ${meter.meter_id}:`, err.message);
      }
    }
    
    // Run leak detection
    console.log('Running leak detection...');
    for (const meter of meters.rows) {
      try {
        await detectLeaks(meter.meter_id);
      } catch (err) {
        console.error(`Leak detection error for ${meter.meter_id}:`, err.message);
      }
    }
    
    // Log completion
    await query(
      'UPDATE sync_log SET status = $1, records_synced = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['success', totalRecords, logId]
    );
    
    console.log(`\nSync completed! Total records synced: ${totalRecords}`);
    
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
