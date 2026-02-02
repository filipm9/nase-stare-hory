import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function WaterDiagnostics() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDiagnostics = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getDiagnostics();
        setDiagnostics(data);
      } catch (err) {
        setError(err.message || 'Nepodarilo sa načítať diagnostiku');
      } finally {
        setLoading(false);
      }
    };

    loadDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Diagnostika vodomera</h2>
              <p className="text-sm text-slate-500 mt-1">Prehľad dát a stav synchronizácie</p>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">Načítavam diagnostiku...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Diagnostika vodomera</h2>
            <p className="text-sm text-slate-500 mt-1">Prehľad dát a stav synchronizácie</p>
          </div>
        </div>
        
        {error ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <p className="text-red-600 font-medium mb-1">Nepodarilo sa načítať diagnostiku</p>
            <p className="text-slate-500 text-sm">{error}</p>
          </div>
        ) : !diagnostics ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <p className="text-slate-500">Nepodarilo sa načítať diagnostiku</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
                <div className="text-3xl font-bold text-cyan-700">{diagnostics.totalReadings}</div>
                <div className="text-sm text-cyan-600 mt-1">Celkom záznamov</div>
              </div>
              <div className={`rounded-xl p-4 border ${diagnostics.readingsWithTemperature > 0 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'}`}>
                <div className={`text-3xl font-bold ${diagnostics.readingsWithTemperature > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {diagnostics.readingsWithTemperature}
                </div>
                <div className={`text-sm mt-1 ${diagnostics.readingsWithTemperature > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  S teplotou
                </div>
              </div>
            </div>

            {diagnostics.dateRange && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-sm text-slate-600">
                  <span className="text-slate-500">Obdobie dát:</span>{' '}
                  <strong>{new Date(diagnostics.dateRange.oldest).toLocaleDateString('sk-SK')}</strong>
                  {' — '}
                  <strong>{new Date(diagnostics.dateRange.newest).toLocaleDateString('sk-SK')}</strong>
                </div>
              </div>
            )}

            {diagnostics.readingsWithTemperature === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <div className="font-medium text-amber-800">Teplota nie je dostupná</div>
                    <div className="text-sm text-amber-600 mt-1">
                      VAS API neposiela údaje o teplote pre váš vodomer.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {diagnostics.recentReadings?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Posledné záznamy</h3>
                <div className="bg-slate-50 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100/80">
                        <th className="text-left py-3 px-4 text-slate-600 font-medium">Dátum</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-medium">Stav (m³)</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-medium">Teplota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.recentReadings.map((r, i) => (
                        <tr key={i} className="border-t border-slate-200/60">
                          <td className="py-3 px-4 text-slate-700">
                            {new Date(r.reading_date).toLocaleString('sk-SK')}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-800 font-medium">
                            {parseFloat(r.state).toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {r.heat !== null ? (
                              <span className="text-emerald-600 font-medium">{r.heat}°C</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
