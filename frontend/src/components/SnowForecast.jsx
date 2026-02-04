import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function SnowForecast({ showToast }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const data = await api.getSnowForecast();
      setForecast(data);
    } catch (err) {
      showToast?.('Nepodarilo sa načítať predpoveď', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!forecast?.available) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Predpoveď nedostupná</h3>
        <p className="text-slate-500">{forecast?.reason || 'Nepodarilo sa načítať dáta z Open-Meteo API'}</p>
      </div>
    );
  }

  const daily = forecast.forecast;
  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Location info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">7-dňová predpoveď</h2>
            <p className="text-sm text-slate-500">
              {forecast.location?.name || `${forecast.location?.lat}, ${forecast.location?.lon}`}
            </p>
          </div>
          <button
            onClick={loadForecast}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Obnoviť"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>
        </div>

        {/* Alert status */}
        {forecast.analysis?.shouldAlert ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl">❄️</span>
              </div>
              <div>
                <p className="font-medium text-blue-800">Upozornenie na sneženie!</p>
                <p className="text-sm text-blue-600 mt-1">
                  Zajtra má nasnežiť {forecast.analysis.tomorrowSnowfall}cm snehu a nasledujúce {forecast.analysis.freezingDays} dni bude mráz.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-800">Žiadne významné sneženie</p>
                <p className="text-sm text-green-600 mt-1">
                  {forecast.analysis?.reason || 'V najbližších 24 hodinách sa neočakáva sneženie vyžadujúce odpratanie.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Forecast - full width grid */}
        <div className="grid grid-cols-7 gap-1">
          {daily?.time?.map((date, index) => {
            const d = new Date(date);
            const isToday = index === 0;
            const snowfall = daily.snowfall_sum?.[index] || 0;
            const tempMax = daily.temperature_2m_max?.[index];
            const tempMin = daily.temperature_2m_min?.[index];
            const isFreezing = tempMax <= 0;
            const hasSnow = snowfall >= 2;

            return (
              <div
                key={date}
                className={`p-3 rounded-xl text-center ${
                  hasSnow
                    ? 'bg-blue-100 ring-2 ring-blue-400'
                    : isFreezing
                    ? 'bg-blue-50'
                    : 'bg-slate-50'
                }`}
              >
                <p className="text-xs font-semibold text-slate-700 uppercase">
                  {d.toLocaleDateString('sk-SK', { weekday: 'short' })}
                </p>
                <p className="text-[11px] text-slate-400 mb-2">
                  {d.getDate()}.{d.getMonth() + 1}.
                </p>
                
                {snowfall > 0 ? (
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-sm">❄️</span>
                    <span className={`text-sm font-bold ${hasSnow ? 'text-blue-600' : 'text-slate-400'}`}>
                      {snowfall}cm
                    </span>
                  </div>
                ) : (
                  <div className="h-6 flex items-center justify-center mb-1">
                    <span className="text-slate-300 text-xs">—</span>
                  </div>
                )}
                
                <div className={`text-sm font-medium ${isFreezing ? 'text-blue-600' : 'text-slate-600'}`}>
                  <span className="text-slate-400">{tempMin !== undefined ? Math.round(tempMin) : '—'}°</span>
                  <span className="mx-0.5 text-slate-300">/</span>
                  <span>{tempMax !== undefined ? Math.round(tempMax) : '—'}°</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
