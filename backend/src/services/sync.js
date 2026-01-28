import { query } from '../db.js';
import * as vasApi from './vas-api.js';
import { detectLeaks } from './leak-detector.js';

export async function syncAll() {
  const logId = await startSyncLog('full');
  
  try {
    // 1. Sync meter info
    await syncMeters();
    
    // 2. Sync readings for all meters
    const meters = await query('SELECT meter_id FROM meters');
    let totalRecords = 0;
    
    for (const meter of meters.rows) {
      const count = await syncReadings(meter.meter_id);
      totalRecords += count;
    }
    
    // 3. Run leak detection
    for (const meter of meters.rows) {
      await detectLeaks(meter.meter_id);
    }
    
    await completeSyncLog(logId, 'success', totalRecords);
    
    return { success: true, recordsSynced: totalRecords };
  } catch (error) {
    await completeSyncLog(logId, 'error', 0, error.message);
    throw error;
  }
}

export async function syncMeters() {
  const customerData = await vasApi.getCustomerData();
  
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
    }
  }
}

export async function syncReadings(meterId, daysBack = 7) {
  // Get last reading date or default to daysBack
  const lastReading = await query(
    'SELECT MAX(reading_date) as last_date FROM readings WHERE meter_id = $1',
    [meterId]
  );
  
  let dateFrom;
  if (lastReading.rows[0]?.last_date) {
    // Start from last reading date
    dateFrom = new Date(lastReading.rows[0].last_date);
  } else {
    // First sync - get last daysBack days
    dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);
  }
  
  const dateTo = new Date();
  
  const readings = await vasApi.getProfileData(meterId, dateFrom, dateTo);
  
  let insertedCount = 0;
  
  for (const reading of readings) {
    try {
      await query(`
        INSERT INTO readings (meter_id, reading_date, state, heat)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (meter_id, reading_date) DO NOTHING
      `, [
        meterId,
        reading.DATE,
        reading.STATE,
        reading.HEAT,
      ]);
      insertedCount++;
    } catch (err) {
      // Ignore duplicates
    }
  }
  
  return insertedCount;
}

export async function syncHistorical(meterId, daysBack = 90) {
  let insertedCount = 0;
  
  // Get meter's installation date to avoid syncing before it existed
  const meterResult = await query(
    'SELECT installed_from FROM meters WHERE meter_id = $1',
    [meterId]
  );
  const installedFrom = meterResult.rows[0]?.installed_from 
    ? new Date(meterResult.rows[0].installed_from)
    : null;
  
  // Split into 30-day chunks to avoid API limits and token expiration
  const chunkSize = 30;
  const dateTo = new Date();
  
  // Calculate the earliest date we should sync from
  let earliestDate = new Date(dateTo);
  earliestDate.setDate(earliestDate.getDate() - daysBack);
  
  // Don't try to sync before meter was installed
  if (installedFrom && installedFrom > earliestDate) {
    console.log(`Meter ${meterId} installed on ${installedFrom.toISOString().split('T')[0]}, limiting sync to that date`);
    earliestDate = installedFrom;
  }
  
  for (let offset = 0; offset < daysBack; offset += chunkSize) {
    const chunkEnd = new Date(dateTo);
    chunkEnd.setDate(chunkEnd.getDate() - offset);
    
    const chunkStart = new Date(chunkEnd);
    chunkStart.setDate(chunkStart.getDate() - Math.min(chunkSize, daysBack - offset));
    
    // Skip chunks that are before meter installation
    if (chunkEnd < earliestDate) {
      console.log(`Skipping chunk ${chunkStart.toISOString().split('T')[0]} to ${chunkEnd.toISOString().split('T')[0]} - before meter installation`);
      continue;
    }
    
    // Adjust chunk start if it's before installation
    const effectiveStart = chunkStart < earliestDate ? earliestDate : chunkStart;
    
    console.log(`Syncing ${meterId}: ${effectiveStart.toISOString().split('T')[0]} to ${chunkEnd.toISOString().split('T')[0]}`);
    
    try {
      const readings = await vasApi.getProfileData(meterId, effectiveStart, chunkEnd);
      
      for (const reading of readings) {
        try {
          await query(`
            INSERT INTO readings (meter_id, reading_date, state, heat)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (meter_id, reading_date) DO NOTHING
          `, [
            meterId,
            reading.DATE,
            reading.STATE,
            reading.HEAT,
          ]);
          insertedCount++;
        } catch (err) {
          // Ignore duplicates
        }
      }
    } catch (err) {
      console.error(`Error syncing chunk ${effectiveStart} - ${chunkEnd}:`, err.message);
      // Continue with next chunk instead of failing completely
    }
  }
  
  return insertedCount;
}

function formatAddress(addr) {
  if (!addr) return null;
  const parts = [addr.STREET, addr.HOUSENUM, addr.STREETNUM, addr.CITY].filter(Boolean);
  return parts.join(' ') || `${addr.CITY} ${addr.HOUSENUM}`;
}

async function startSyncLog(syncType) {
  const result = await query(
    'INSERT INTO sync_log (sync_type, status) VALUES ($1, $2) RETURNING id',
    [syncType, 'running']
  );
  return result.rows[0].id;
}

async function completeSyncLog(id, status, recordsSynced, errorMessage = null) {
  await query(
    'UPDATE sync_log SET status = $1, records_synced = $2, error_message = $3, completed_at = CURRENT_TIMESTAMP WHERE id = $4',
    [status, recordsSynced, errorMessage, id]
  );
}
