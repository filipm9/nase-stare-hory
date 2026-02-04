import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.dbUrl,
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

export async function getClient() {
  return pool.connect();
}

export async function runMigrations() {
  console.log('Running database migrations...');
  
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS meters (
      id SERIAL PRIMARY KEY,
      meter_id BIGINT UNIQUE NOT NULL,
      meter_number VARCHAR(50),
      cp_id BIGINT,
      address TEXT,
      gps VARCHAR(100),
      installed_from TIMESTAMP,
      radio_number VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS readings (
      id SERIAL PRIMARY KEY,
      meter_id BIGINT NOT NULL REFERENCES meters(meter_id),
      reading_date TIMESTAMP NOT NULL,
      state DECIMAL(12, 4) NOT NULL,
      heat DECIMAL(5, 1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(meter_id, reading_date)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_readings_meter_date 
    ON readings(meter_id, reading_date DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      meter_id BIGINT NOT NULL REFERENCES meters(meter_id),
      alert_type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      value DECIMAL(12, 4),
      threshold DECIMAL(12, 4),
      is_read BOOLEAN DEFAULT FALSE,
      email_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_meter_created 
    ON alerts(meter_id, created_at DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      sync_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_subscriptions (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Snow alerts table
  await query(`
    CREATE TABLE IF NOT EXISTS snow_alerts (
      id SERIAL PRIMARY KEY,
      alert_type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      snowfall_cm DECIMAL(5, 1),
      freezing_days INTEGER,
      snow_date DATE,
      is_read BOOLEAN DEFAULT FALSE,
      email_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_snow_alerts_created 
    ON snow_alerts(created_at DESC)
  `);

  // Waste pickups table
  await query(`
    CREATE TABLE IF NOT EXISTS waste_pickups (
      id SERIAL PRIMARY KEY,
      pickup_date DATE NOT NULL,
      waste_type VARCHAR(20) NOT NULL CHECK (waste_type IN ('komunal', 'plast', 'papier')),
      notes TEXT,
      notification_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pickup_date, waste_type)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_waste_pickups_date 
    ON waste_pickups(pickup_date)
  `);

  // Waste alerts table
  await query(`
    CREATE TABLE IF NOT EXISTS waste_alerts (
      id SERIAL PRIMARY KEY,
      alert_type VARCHAR(50) NOT NULL,
      waste_type VARCHAR(20),
      message TEXT NOT NULL,
      pickup_date DATE,
      is_read BOOLEAN DEFAULT FALSE,
      email_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_waste_alerts_created 
    ON waste_alerts(created_at DESC)
  `);

  // Settlements table for water/electricity billing calculations
  await query(`
    CREATE TABLE IF NOT EXISTS settlements (
      id SERIAL PRIMARY KEY,
      settlement_type VARCHAR(20) NOT NULL CHECK (settlement_type IN ('water', 'electricity')),
      period_year INTEGER NOT NULL,
      period_label VARCHAR(100),
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
      readings JSONB NOT NULL DEFAULT '{}',
      financials JSONB NOT NULL DEFAULT '{}',
      calculation JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      email_sent BOOLEAN DEFAULT FALSE,
      UNIQUE(settlement_type, period_year)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_settlements_type_year 
    ON settlements(settlement_type, period_year DESC)
  `);

  // Seed default admin user if no users exist
  const usersCount = await query('SELECT COUNT(*) FROM users');
  if (parseInt(usersCount.rows[0].count) === 0) {
    const bcrypt = await import('bcryptjs');
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.default.hash(defaultPassword, 10);
    
    await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
      ['admin@stare-hory.sk', passwordHash]
    );
    console.log('Created default admin user: admin@stare-hory.sk');
  }

  console.log('Migrations completed successfully');
}
