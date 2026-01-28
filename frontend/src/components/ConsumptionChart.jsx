import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Brush
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { sk } from 'date-fns/locale';

// Helper to format date for input[type="date"]
function toDateInputValue(date) {
  return date.toISOString().split('T')[0];
}

export default function ConsumptionChart({ meterId }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTemperature, setShowTemperature] = useState(false);
  
  // Date range state - default last 30 days
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));

  useEffect(() => {
    loadReadings();
  }, [meterId, dateFrom, dateTo]);

  const loadReadings = async () => {
    setLoading(true);
    try {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59); // Include full day
      
      const daysDiff = differenceInDays(to, from);
      
      // Determine aggregation based on date range
      let aggregation = null;
      if (daysDiff > 14) {
        aggregation = 'daily';
      } else if (daysDiff > 2) {
        aggregation = 'hourly';
      }
      
      const params = {
        from: from.toISOString(),
        to: to.toISOString(),
      };
      
      if (aggregation) {
        params.aggregation = aggregation;
      }

      const data = await api.getReadings(meterId, params);
      setReadings(data.reverse());
    } catch (err) {
      console.error('Load readings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const daysDiff = differenceInDays(new Date(dateTo), new Date(dateFrom));
    
    const data = readings.map(r => {
      // Handle both raw readings (heat) and aggregated (avg_heat)
      const heatValue = r.heat !== undefined ? r.heat : r.avg_heat;
      const temp = heatValue !== null && heatValue !== undefined ? parseFloat(heatValue) : null;
      
      return {
        date: r.date || r.reading_date,
        consumption: parseFloat(r.consumption) || 0,
        state: parseFloat(r.state || r.max_state) || 0,
        temperature: temp !== null && !isNaN(temp) ? temp : null,
        label: formatDateLabel(r.date || r.reading_date, daysDiff),
      };
    }).filter(d => d.consumption >= 0);
    
    // Debug: log first few records to see temperature data
    if (data.length > 0) {
      console.log('Chart data sample:', data.slice(0, 3));
      console.log('Temperature values:', data.slice(0, 10).map(d => d.temperature));
    }
    
    return data;
  }, [readings, dateFrom, dateTo]);
  
  // Check if temperature data is available
  const hasTemperatureData = useMemo(() => {
    return chartData.some(d => d.temperature !== null);
  }, [chartData]);

  const totalConsumption = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.consumption, 0);
  }, [chartData]);

  const avgConsumption = useMemo(() => {
    return chartData.length > 0 ? totalConsumption / chartData.length : 0;
  }, [chartData, totalConsumption]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-80 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Spotreba vody</h2>
          <p className="text-sm text-slate-500">
            Celkom: <strong>{totalConsumption.toFixed(3)} m³</strong>
            {' • '}Priemer: <strong>{avgConsumption.toFixed(4)} m³</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date range inputs */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Od:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Do:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              max={toDateInputValue(new Date())}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Temperature toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTemperature}
              onChange={(e) => setShowTemperature(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <span className={showTemperature ? 'text-amber-600 font-medium' : ''}>
              Teplota
            </span>
            {!hasTemperatureData && showTemperature && (
              <span className="text-xs text-slate-400">(žiadne dáta)</span>
            )}
          </label>
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-slate-400">
          Žiadne dáta pre zvolené obdobie
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: showTemperature ? 60 : 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                yAxisId="consumption"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => `${v.toFixed(2)}`}
                label={{ value: 'm³', angle: -90, position: 'insideLeft', fill: '#64748b' }}
              />
              {showTemperature && (
                <YAxis 
                  yAxisId="temp"
                  orientation="right"
                  tick={{ fontSize: 12, fill: '#f59e0b' }}
                  tickLine={{ stroke: '#f59e0b' }}
                  tickFormatter={(v) => `${v}°`}
                  domain={['auto', 'auto']}
                />
              )}
              <Tooltip 
                content={<CustomTooltip showTemperature={showTemperature} />}
              />
              <Legend />
              
              <Area 
                yAxisId="consumption"
                type="monotone" 
                dataKey="consumption" 
                name="Spotreba (m³)"
                stroke="#3b82f6" 
                fill="#93c5fd"
                fillOpacity={0.6}
              />

              {showTemperature && (
                <Line 
                  yAxisId="temp"
                  type="monotone" 
                  dataKey="temperature" 
                  name="Teplota (°C)"
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', r: 3 }}
                  connectNulls
                />
              )}

              {chartData.length > 20 && (
                <Brush 
                  dataKey="label" 
                  height={30} 
                  stroke="#3b82f6"
                  fill="#f1f5f9"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label, showTemperature }) {
  if (!active || !payload?.length) return null;

  const consumption = payload.find(p => p.dataKey === 'consumption');
  const temperature = payload.find(p => p.dataKey === 'temperature');

  return (
    <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-200">
      <p className="text-sm font-medium text-slate-800 mb-1">{label}</p>
      {consumption && (
        <p className="text-sm text-blue-600">
          Spotreba: <strong>{consumption.value?.toFixed(4)} m³</strong>
        </p>
      )}
      {showTemperature && temperature?.value != null && (
        <p className="text-sm text-amber-600">
          Teplota: <strong>{temperature.value?.toFixed(1)} °C</strong>
        </p>
      )}
    </div>
  );
}

function formatDateLabel(dateStr, daysDiff) {
  try {
    const date = parseISO(dateStr);
    if (daysDiff <= 2) {
      return format(date, 'HH:mm', { locale: sk });
    } else if (daysDiff <= 14) {
      return format(date, 'EEE HH:mm', { locale: sk });
    } else {
      return format(date, 'd.M.', { locale: sk });
    }
  } catch {
    return dateStr;
  }
}
