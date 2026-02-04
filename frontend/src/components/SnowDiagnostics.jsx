import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function SnowDiagnostics({ showToast }) {
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
      showToast?.('Nepodarilo sa načítať diagnostiku', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const analysis = forecast?.analysis;

  return (
    <div className="space-y-6">
      {/* Decision Logic */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Logika rozhodovania</h2>
        
        <div className="space-y-4">
          {/* Flowchart */}
          <div className="bg-slate-50 rounded-xl p-6">
            <div className="flex flex-col items-center space-y-4">
              {/* Step 1 */}
              <div className="w-full max-w-md">
                <div className="bg-white border-2 border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-slate-500 mb-1">Krok 1</p>
                  <p className="font-medium text-slate-800">Stiahni 7-dňovú predpoveď</p>
                  <p className="text-xs text-slate-400 mt-1">Open-Meteo API • Sivice 276</p>
                </div>
              </div>
              
              <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>

              {/* Step 2 */}
              <div className="w-full max-w-md">
                <div className={`border-2 rounded-xl p-4 text-center ${
                  analysis?.tomorrowSnowfall >= 2 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-white border-slate-200'
                }`}>
                  <p className="text-sm text-slate-500 mb-1">Krok 2</p>
                  <p className="font-medium text-slate-800">Sneženie zajtra ≥ 2cm?</p>
                  {analysis && (
                    <p className={`text-sm mt-2 font-medium ${
                      analysis.tomorrowSnowfall >= 2 ? 'text-green-600' : 'text-slate-500'
                    }`}>
                      Aktuálne: {analysis.tomorrowSnowfall || 0}cm 
                      {analysis.tomorrowSnowfall >= 2 ? ' ✓' : ' ✗'}
                    </p>
                  )}
                </div>
              </div>

              <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>

              {/* Step 3 */}
              <div className="w-full max-w-md">
                <div className={`border-2 rounded-xl p-4 text-center ${
                  analysis?.freezingDays >= 2 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-white border-slate-200'
                }`}>
                  <p className="text-sm text-slate-500 mb-1">Krok 3</p>
                  <p className="font-medium text-slate-800">Mráz ≥ 2 dni po snežení?</p>
                  <p className="text-xs text-slate-400">(max teplota ≤ 0°C)</p>
                  {analysis && (
                    <p className={`text-sm mt-2 font-medium ${
                      analysis.freezingDays >= 2 ? 'text-green-600' : 'text-slate-500'
                    }`}>
                      Aktuálne: {analysis.freezingDays || 0} dni
                      {analysis.freezingDays >= 2 ? ' ✓' : ' ✗'}
                    </p>
                  )}
                </div>
              </div>

              <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>

              {/* Result */}
              <div className="w-full max-w-md">
                <div className={`border-2 rounded-xl p-4 text-center ${
                  analysis?.shouldAlert 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'bg-slate-100 border-slate-300'
                }`}>
                  <p className="text-sm text-slate-500 mb-1">Výsledok</p>
                  <p className={`font-semibold ${analysis?.shouldAlert ? 'text-blue-700' : 'text-slate-600'}`}>
                    {analysis?.shouldAlert ? '🚨 VYTVOR ALERT' : '✓ Žiadny alert'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Prahy (Thresholds)</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-lg">❄️</span>
              </div>
              <div>
                <p className="font-medium text-slate-800">Minimálne sneženie</p>
                <p className="text-2xl font-bold text-blue-600">2 cm</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Sneženie menšie ako 2cm nevyžaduje odpratanie
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-lg">🥶</span>
              </div>
              <div>
                <p className="font-medium text-slate-800">Minimálne dni mráz</p>
                <p className="text-2xl font-bold text-blue-600">2 dni</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Ak je menej mrazivých dní, sneh sa roztopí sám
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-lg">🌡️</span>
              </div>
              <div>
                <p className="font-medium text-slate-800">Hranica mráz</p>
                <p className="text-2xl font-bold text-blue-600">≤ 0°C</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Max denná teplota musí byť pod/rovno 0°C
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-lg">⏰</span>
              </div>
              <div>
                <p className="font-medium text-slate-800">Časové okno</p>
                <p className="text-2xl font-bold text-blue-600">24h</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Alert len ak má snežiť zajtra (nie o týždeň)
            </p>
          </div>
        </div>
      </div>

      {/* Data Source */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Zdroj dát</h2>
        
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">OM</span>
          </div>
          <div>
            <h3 className="font-medium text-slate-800">Open-Meteo API</h3>
            <p className="text-sm text-slate-500 mt-1">
              Bezplatné meteorologické API bez potreby API kľúča. 
              Poskytuje 7-dňovú predpoveď s hodinovou presnosťou.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Zadarmo
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                Bez API kľúča
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                EU servery
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 font-mono break-all">
            https://api.open-meteo.com/v1/forecast?latitude=49.2167&longitude=16.8333&daily=snowfall_sum,temperature_2m_max,temperature_2m_min
          </p>
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Lokácia</h2>
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-slate-800">Sivice 276</h3>
            <p className="text-sm text-slate-500">49.2167° N, 16.8333° E</p>
            <p className="text-xs text-slate-400 mt-1">Staticky nastavené v kóde</p>
          </div>
        </div>
      </div>
    </div>
  );
}
