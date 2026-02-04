import { Router } from 'express';
import { query } from '../db.js';
import { sendSettlementBackup } from '../services/email.js';

const router = Router();

// Get all settlements (optionally filter by type)
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM settlements';
    const params = [];
    
    if (type) {
      sql += ' WHERE settlement_type = $1';
      params.push(type);
    }
    
    sql += ' ORDER BY period_year DESC, settlement_type';
    
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to get settlements:', err);
    res.status(500).json({ error: 'Failed to get settlements' });
  }
});

// Get single settlement
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM settlements WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to get settlement:', err);
    res.status(500).json({ error: 'Failed to get settlement' });
  }
});

// Get latest completed settlement for a type (to get "previous" values)
router.get('/latest/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const result = await query(
      `SELECT * FROM settlements 
       WHERE settlement_type = $1 AND status = 'completed'
       ORDER BY period_year DESC 
       LIMIT 1`,
      [type]
    );
    
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Failed to get latest settlement:', err);
    res.status(500).json({ error: 'Failed to get latest settlement' });
  }
});

// Create or update draft settlement
router.post('/', async (req, res) => {
  try {
    const { settlement_type, period_year, period_label, readings, financials } = req.body;
    
    if (!settlement_type || !period_year) {
      return res.status(400).json({ error: 'settlement_type and period_year required' });
    }
    
    // Check if draft exists for this type/year
    const existing = await query(
      `SELECT id FROM settlements 
       WHERE settlement_type = $1 AND period_year = $2`,
      [settlement_type, period_year]
    );
    
    if (existing.rows.length > 0) {
      // Update existing
      const result = await query(
        `UPDATE settlements 
         SET readings = $1, financials = $2, period_label = $3
         WHERE settlement_type = $4 AND period_year = $5
         RETURNING *`,
        [
          JSON.stringify(readings || {}),
          JSON.stringify(financials || {}),
          period_label || null,
          settlement_type,
          period_year
        ]
      );
      return res.json(result.rows[0]);
    }
    
    // Create new
    const result = await query(
      `INSERT INTO settlements (settlement_type, period_year, period_label, readings, financials)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        settlement_type,
        period_year,
        period_label || null,
        JSON.stringify(readings || {}),
        JSON.stringify(financials || {})
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create/update settlement:', err);
    res.status(500).json({ error: 'Failed to create/update settlement' });
  }
});

// Calculate water settlement
function calculateWater(readings, financials) {
  const steps = [];
  
  // Extract meter readings
  const mainMeter = {
    previous: parseFloat(readings.main_cold?.previous || 0),
    current: parseFloat(readings.main_cold?.current || 0),
  };
  mainMeter.consumption = mainMeter.current - mainMeter.previous;
  steps.push({ label: 'Hlavný vodomer - spotreba', value: mainMeter.consumption, unit: 'm³' });
  
  // Filip's sub-meters
  const filipCold = {
    previous: parseFloat(readings.filip_cold?.previous || 0),
    current: parseFloat(readings.filip_cold?.current || 0),
  };
  filipCold.consumption = filipCold.current - filipCold.previous;
  
  const filipIrrigation = {
    previous: parseFloat(readings.filip_irrigation?.previous || 0),
    current: parseFloat(readings.filip_irrigation?.current || 0),
  };
  filipIrrigation.consumption = filipIrrigation.current - filipIrrigation.previous;
  
  const filipHot = {
    previous: parseFloat(readings.filip_hot?.previous || 0),
    current: parseFloat(readings.filip_hot?.current || 0),
  };
  filipHot.consumption = filipHot.current - filipHot.previous;
  
  // Benny's sub-meters  
  const bennyIrrigation = {
    previous: parseFloat(readings.benny_irrigation?.previous || 0),
    current: parseFloat(readings.benny_irrigation?.current || 0),
  };
  bennyIrrigation.consumption = bennyIrrigation.current - bennyIrrigation.previous;
  
  const bennyHot = {
    previous: parseFloat(readings.benny_hot?.previous || 0),
    current: parseFloat(readings.benny_hot?.current || 0),
  };
  bennyHot.consumption = bennyHot.current - bennyHot.previous;
  
  // Calculate total Filip consumption
  const filipTotal = filipCold.consumption + filipIrrigation.consumption + filipHot.consumption;
  steps.push({ label: 'Filip - studená', value: filipCold.consumption, unit: 'm³' });
  steps.push({ label: 'Filip - zálievka', value: filipIrrigation.consumption, unit: 'm³' });
  steps.push({ label: 'Filip - teplá', value: filipHot.consumption, unit: 'm³' });
  steps.push({ label: 'Filip - celkom', value: filipTotal, unit: 'm³', highlight: true });
  
  // Benny = Main - Filip total
  const bennyTotal = mainMeter.consumption - filipTotal;
  steps.push({ label: 'Benny - zálievka (kontrola)', value: bennyIrrigation.consumption, unit: 'm³' });
  steps.push({ label: 'Benny - teplá (kontrola)', value: bennyHot.consumption, unit: 'm³' });
  steps.push({ label: 'Benny - celkom (hlavný - Filip)', value: bennyTotal, unit: 'm³', highlight: true });
  
  // Control sum
  const submetersTotal = bennyIrrigation.consumption + filipCold.consumption + filipIrrigation.consumption + bennyHot.consumption + filipHot.consumption;
  steps.push({ label: 'Kontrola - súčet podružných', value: submetersTotal, unit: 'm³' });
  
  // Percentages
  const totalConsumption = mainMeter.consumption;
  const bennyPercent = totalConsumption > 0 ? (bennyTotal / totalConsumption) * 100 : 0;
  const filipPercent = totalConsumption > 0 ? (filipTotal / totalConsumption) * 100 : 0;
  
  steps.push({ label: 'Pomer Benny', value: bennyPercent, unit: '%', highlight: true });
  steps.push({ label: 'Pomer Filip', value: filipPercent, unit: '%', highlight: true });
  
  // Financial calculation
  const advances = parseFloat(financials.advances || 0);
  const invoiced = parseFloat(financials.invoiced || 0);
  const difference = invoiced - advances;
  
  steps.push({ label: 'Zaplatené zálohy', value: advances, unit: 'Kč' });
  steps.push({ label: 'Vyfakturovaná čiastka', value: invoiced, unit: 'Kč' });
  steps.push({ label: 'Rozdiel (doplatok)', value: difference, unit: 'Kč' });
  
  // Split by percentage (assuming 50/50 advance split)
  const bennyShare = invoiced * (bennyPercent / 100);
  const filipShare = invoiced * (filipPercent / 100);
  const advanceEach = advances / 2;
  
  const bennyPayment = bennyShare - advanceEach;
  const filipPayment = filipShare - advanceEach;
  
  steps.push({ label: 'Benny - podiel z faktúry', value: bennyShare, unit: 'Kč' });
  steps.push({ label: 'Filip - podiel z faktúry', value: filipShare, unit: 'Kč' });
  steps.push({ label: 'Záloha na osobu (50/50)', value: advanceEach, unit: 'Kč' });
  
  return {
    steps,
    summary: {
      benny: {
        consumption: bennyTotal,
        percent: bennyPercent,
        payment: bennyPayment,
      },
      filip: {
        consumption: filipTotal,
        percent: filipPercent,
        payment: filipPayment,
      },
      total: {
        consumption: totalConsumption,
        advances,
        invoiced,
        difference,
      },
    },
    meters: {
      mainMeter,
      filipCold,
      filipIrrigation,
      filipHot,
      bennyIrrigation,
      bennyHot,
    },
  };
}

// Calculate electricity settlement
function calculateElectricity(readings, financials) {
  const steps = [];
  
  // Main electricity meter
  const mainElectric = {
    previous: parseFloat(readings.main_electric?.previous || 0),
    current: parseFloat(readings.main_electric?.current || 0),
  };
  mainElectric.consumption = mainElectric.current - mainElectric.previous;
  steps.push({ label: 'Hlavný elektromer - spotreba', value: mainElectric.consumption, unit: 'kWh' });
  
  // Filip personal meter
  const filipElectric = {
    previous: parseFloat(readings.filip_electric?.previous || 0),
    current: parseFloat(readings.filip_electric?.current || 0),
  };
  filipElectric.consumption = filipElectric.current - filipElectric.previous;
  steps.push({ label: 'Filip - osobná spotreba', value: filipElectric.consumption, unit: 'kWh' });
  
  // Common consumption meter
  const commonElectric = {
    previous: parseFloat(readings.common_electric?.previous || 0),
    current: parseFloat(readings.common_electric?.current || 0),
  };
  commonElectric.consumption = commonElectric.current - commonElectric.previous;
  steps.push({ label: 'Spoločná spotreba (elektromer)', value: commonElectric.consumption, unit: 'kWh' });
  
  // Benny personal = Main - Filip - Common
  const bennyPersonal = mainElectric.consumption - filipElectric.consumption - commonElectric.consumption;
  steps.push({ label: 'Benny - osobná spotreba', value: bennyPersonal, unit: 'kWh', highlight: true });
  
  // Control
  const controlSum = filipElectric.consumption + commonElectric.consumption;
  steps.push({ label: 'Kontrola (Filip + spoločná)', value: controlSum, unit: 'kWh' });
  
  // === SPOLOČNÁ SPOTREBA - ROZPOČÍTANIE PODĽA TEPLA ===
  steps.push({ label: '--- ROZPOČÍTANIE SPOLOČNEJ SPOTREBY ---', value: null, unit: '', section: true });
  
  // Calorimeters (heating)
  const bennyHeating = {
    previous: parseFloat(readings.benny_heating?.previous || 0),
    current: parseFloat(readings.benny_heating?.current || 0),
  };
  bennyHeating.consumption = bennyHeating.current - bennyHeating.previous;
  
  const filipHeating = {
    previous: parseFloat(readings.filip_heating?.previous || 0),
    current: parseFloat(readings.filip_heating?.current || 0),
  };
  filipHeating.consumption = filipHeating.current - filipHeating.previous;
  
  const hotWaterCal = {
    previous: parseFloat(readings.hot_water_cal?.previous || 0),
    current: parseFloat(readings.hot_water_cal?.current || 0),
  };
  hotWaterCal.consumption = hotWaterCal.current - hotWaterCal.previous;
  
  steps.push({ label: 'Kalorimeter Benny (vykurovanie)', value: bennyHeating.consumption, unit: 'GJ' });
  steps.push({ label: 'Kalorimeter Filip (vykurovanie)', value: filipHeating.consumption, unit: 'GJ' });
  steps.push({ label: 'Kalorimeter teplá voda', value: hotWaterCal.consumption, unit: 'GJ' });
  
  // Hot water meters (for proportional split of hot water calorimeter)
  const bennyHotWater = {
    previous: parseFloat(readings.benny_hot_water?.previous || 0),
    current: parseFloat(readings.benny_hot_water?.current || 0),
  };
  bennyHotWater.consumption = bennyHotWater.current - bennyHotWater.previous;
  
  const filipHotWater = {
    previous: parseFloat(readings.filip_hot_water?.previous || 0),
    current: parseFloat(readings.filip_hot_water?.current || 0),
  };
  filipHotWater.consumption = filipHotWater.current - filipHotWater.previous;
  
  const totalHotWater = bennyHotWater.consumption + filipHotWater.consumption;
  
  steps.push({ label: 'Vodomer teplej vody Benny', value: bennyHotWater.consumption, unit: 'm³' });
  steps.push({ label: 'Vodomer teplej vody Filip', value: filipHotWater.consumption, unit: 'm³' });
  steps.push({ label: 'Celková spotreba teplej vody', value: totalHotWater, unit: 'm³' });
  
  // Hot water ratio
  const bennyHotWaterRatio = totalHotWater > 0 ? bennyHotWater.consumption / totalHotWater : 0.5;
  const filipHotWaterRatio = totalHotWater > 0 ? filipHotWater.consumption / totalHotWater : 0.5;
  
  steps.push({ label: 'Pomer teplej vody Benny', value: bennyHotWaterRatio * 100, unit: '%' });
  steps.push({ label: 'Pomer teplej vody Filip', value: filipHotWaterRatio * 100, unit: '%' });
  
  // Split hot water calorimeter by hot water ratio
  const bennyHotWaterGJ = hotWaterCal.consumption * bennyHotWaterRatio;
  const filipHotWaterGJ = hotWaterCal.consumption * filipHotWaterRatio;
  
  steps.push({ label: 'Teplá voda Benny (GJ)', value: bennyHotWaterGJ, unit: 'GJ' });
  steps.push({ label: 'Teplá voda Filip (GJ)', value: filipHotWaterGJ, unit: 'GJ' });
  
  // Total heating per person
  const bennyTotalHeat = bennyHeating.consumption + bennyHotWaterGJ;
  const filipTotalHeat = filipHeating.consumption + filipHotWaterGJ;
  const totalHeat = bennyTotalHeat + filipTotalHeat;
  
  steps.push({ label: 'Celkové teplo Benny', value: bennyTotalHeat, unit: 'GJ', highlight: true });
  steps.push({ label: 'Celkové teplo Filip', value: filipTotalHeat, unit: 'GJ', highlight: true });
  steps.push({ label: 'Kontrola celkového tepla', value: totalHeat, unit: 'GJ' });
  
  // Heating ratio for splitting common electricity
  const bennyHeatRatio = totalHeat > 0 ? bennyTotalHeat / totalHeat : 0.5;
  const filipHeatRatio = totalHeat > 0 ? filipTotalHeat / totalHeat : 0.5;
  
  steps.push({ label: 'Pomer tepla Benny', value: bennyHeatRatio * 100, unit: '%' });
  steps.push({ label: 'Pomer tepla Filip', value: filipHeatRatio * 100, unit: '%' });
  
  // Split common electricity by heating ratio
  const bennyCommonElectric = commonElectric.consumption * bennyHeatRatio;
  const filipCommonElectric = commonElectric.consumption * filipHeatRatio;
  
  steps.push({ label: 'Spoločná elektrina Benny', value: bennyCommonElectric, unit: 'kWh' });
  steps.push({ label: 'Spoločná elektrina Filip', value: filipCommonElectric, unit: 'kWh' });
  
  // Total electricity per person
  const bennyTotalElectric = bennyPersonal + bennyCommonElectric;
  const filipTotalElectric = filipElectric.consumption + filipCommonElectric;
  const totalElectric = bennyTotalElectric + filipTotalElectric;
  
  steps.push({ label: '--- CELKOVÁ SPOTREBA ELEKTRO ---', value: null, unit: '', section: true });
  steps.push({ label: 'Celková elektrina Benny', value: bennyTotalElectric, unit: 'kWh', highlight: true });
  steps.push({ label: 'Celková elektrina Filip', value: filipTotalElectric, unit: 'kWh', highlight: true });
  
  // Percentages
  const bennyPercent = totalElectric > 0 ? (bennyTotalElectric / totalElectric) * 100 : 0;
  const filipPercent = totalElectric > 0 ? (filipTotalElectric / totalElectric) * 100 : 0;
  
  steps.push({ label: 'Pomer elektro Benny', value: bennyPercent, unit: '%', highlight: true });
  steps.push({ label: 'Pomer elektro Filip', value: filipPercent, unit: '%', highlight: true });
  
  // Financial calculation
  const advances = parseFloat(financials.advances || 0);
  const invoiced = parseFloat(financials.invoiced || 0);
  const difference = invoiced - advances;
  
  steps.push({ label: '--- FINANCIE ---', value: null, unit: '', section: true });
  steps.push({ label: 'Zaplatené zálohy', value: advances, unit: 'Kč' });
  steps.push({ label: 'Vyfakturovaná čiastka', value: invoiced, unit: 'Kč' });
  steps.push({ label: 'Rozdiel (doplatok)', value: difference, unit: 'Kč' });
  
  // Split by percentage (assuming 50/50 advance split)
  const bennyShare = invoiced * (bennyPercent / 100);
  const filipShare = invoiced * (filipPercent / 100);
  const advanceEach = advances / 2;
  
  const bennyPayment = bennyShare - advanceEach;
  const filipPayment = filipShare - advanceEach;
  
  steps.push({ label: 'Benny - podiel z faktúry', value: bennyShare, unit: 'Kč' });
  steps.push({ label: 'Filip - podiel z faktúry', value: filipShare, unit: 'Kč' });
  steps.push({ label: 'Záloha na osobu (50/50)', value: advanceEach, unit: 'Kč' });
  
  return {
    steps,
    summary: {
      benny: {
        personal: bennyPersonal,
        common: bennyCommonElectric,
        total: bennyTotalElectric,
        percent: bennyPercent,
        payment: bennyPayment,
      },
      filip: {
        personal: filipElectric.consumption,
        common: filipCommonElectric,
        total: filipTotalElectric,
        percent: filipPercent,
        payment: filipPayment,
      },
      total: {
        consumption: mainElectric.consumption,
        common: commonElectric.consumption,
        advances,
        invoiced,
        difference,
      },
    },
    meters: {
      mainElectric,
      filipElectric,
      commonElectric,
      bennyHeating,
      filipHeating,
      hotWaterCal,
      bennyHotWater,
      filipHotWater,
    },
  };
}

// Calculate settlement
router.post('/:id/calculate', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM settlements WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    const settlement = result.rows[0];
    const { readings, financials, settlement_type } = settlement;
    
    let calculation;
    if (settlement_type === 'water') {
      calculation = calculateWater(readings, financials);
    } else if (settlement_type === 'electricity') {
      calculation = calculateElectricity(readings, financials);
    } else {
      return res.status(400).json({ error: 'Unknown settlement type' });
    }
    
    // Save calculation result
    const updated = await query(
      `UPDATE settlements SET calculation = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(calculation), id]
    );
    
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Failed to calculate settlement:', err);
    res.status(500).json({ error: 'Failed to calculate settlement' });
  }
});

// Complete settlement (finalize and optionally send email backup)
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { sendEmail } = req.body;
    
    const result = await query('SELECT * FROM settlements WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    const settlement = result.rows[0];
    
    // Ensure calculation exists
    if (!settlement.calculation) {
      return res.status(400).json({ error: 'Settlement must be calculated first' });
    }
    
    // Mark as completed
    const updated = await query(
      `UPDATE settlements 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    
    // Send email backup if requested
    if (sendEmail) {
      try {
        await sendSettlementBackup(updated.rows[0]);
        await query(
          'UPDATE settlements SET email_sent = TRUE WHERE id = $1',
          [id]
        );
      } catch (emailErr) {
        console.error('Failed to send settlement backup email:', emailErr);
        // Don't fail the completion, just log
      }
    }
    
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Failed to complete settlement:', err);
    res.status(500).json({ error: 'Failed to complete settlement' });
  }
});

// Delete settlement (only drafts)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `DELETE FROM settlements WHERE id = $1 AND status = 'draft' RETURNING id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot delete completed settlement' });
    }
    
    res.json({ deleted: true });
  } catch (err) {
    console.error('Failed to delete settlement:', err);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
});

export default router;
