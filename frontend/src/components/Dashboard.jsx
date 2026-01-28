import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConsumptionChart from './ConsumptionChart';
import AlertsPanel from './AlertsPanel';
import StatsCards from './StatsCards';
import SettingsPanel from './SettingsPanel';

export default function Dashboard({ onLogout }) {
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [stats, setStats] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('consumption');
  const [syncLogs, setSyncLogs] = useState([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDays, setSyncDays] = useState(7);
  const [syncProgress, setSyncProgress] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMeter) {
      loadStats();
    }
  }, [selectedMeter]);

  const loadData = async () => {
    try {
      const [metersData, countData, logsData] = await Promise.all([
        api.getMeters(),
        api.getUnreadCount(),
        api.getSyncLogs(),
      ]);
      
      setMeters(metersData);
      setUnreadCount(countData.count);
      setSyncLogs(logsData);
      
      if (metersData.length > 0 && !selectedMeter) {
        setSelectedMeter(metersData[0]);
      }
    } catch (err) {
      console.error('Load data error:', err);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await api.getStats(selectedMeter.meter_id);
      setStats(statsData);
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };

  const handleOpenSyncModal = () => {
    setShowSyncModal(true);
    setSyncProgress(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress({
      status: 'running',
      message: `Sťahujem dáta za posledných ${syncDays} dní z VAS API...`,
      details: [
        `Obdobie: ${syncDays} dní`,
        'Zdroj: api.vas.sk',
        'Typ: hodinové odpočty vodomera',
      ],
    });
    
    try {
      const result = await api.syncHistorical(syncDays);
      setSyncProgress({
        status: 'success',
        message: 'Synchronizácia dokončená',
        details: [
          `Stiahnutých záznamov: ${result.recordsSynced}`,
          `Obdobie: ${syncDays} dní`,
        ],
      });
      await loadData();
      if (selectedMeter) {
        await loadStats();
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncProgress({
        status: 'error',
        message: 'Synchronizácia zlyhala',
        details: [err.message],
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-slate-800">Naše Staré Hory</h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Sync button */}
              <button
                onClick={handleOpenSyncModal}
                disabled={syncing}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition disabled:opacity-50 flex items-center gap-2"
              >
                <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                </svg>
                {syncing ? 'Sync...' : 'Sync'}
              </button>

              {/* Settings */}
              <button
                onClick={() => setActiveTab('settings')}
                className={`p-2 rounded-lg transition ${
                  activeTab === 'settings'
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Nastavenia"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>

              {/* Alerts badge */}
              <button
                onClick={() => setActiveTab('alerts')}
                className={`relative p-2 rounded-lg transition ${
                  activeTab === 'alerts'
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Alerty"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={onLogout}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Odhlásiť
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Meter info bar */}
        {selectedMeter && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-slate-800">
                    {selectedMeter.address || `Vodomer ${selectedMeter.meter_number}`}
                  </div>
                  <div className="text-sm text-slate-500">
                    Stav: <strong>{parseFloat(selectedMeter.latest_state)?.toFixed(3) || '—'} m³</strong>
                    {selectedMeter.latest_reading && (
                      <> • {new Date(selectedMeter.latest_reading).toLocaleString('sk-SK')}</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('consumption')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'consumption'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Spotreba
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                activeTab === 'alerts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Alerty
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              História sync
            </button>
          </nav>
        </div>

        {/* Content */}
        {meters.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">Žiadne vodomery</h3>
            <p className="text-slate-500 mb-4">Kliknite na "Sync" pre načítanie dát z VAS API</p>
            <button
              onClick={handleOpenSyncModal}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {syncing ? 'Synchronizujem...' : 'Synchronizovať dáta'}
            </button>
          </div>
        ) : activeTab === 'consumption' ? (
          <div className="space-y-6">
            {stats && <StatsCards stats={stats} />}
            {selectedMeter && <ConsumptionChart meterId={selectedMeter.meter_id} />}
          </div>
        ) : activeTab === 'alerts' ? (
          <AlertsPanel onCountChange={setUnreadCount} />
        ) : activeTab === 'history' ? (
          <SyncHistory logs={syncLogs} />
        ) : (
          <SettingsPanel />
        )}
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  Synchronizácia dát
                </h3>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {!syncProgress ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Počet dní na stiahnutie
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={syncDays}
                        onChange={(e) => setSyncDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 7)))}
                        min="1"
                        max="365"
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <span className="text-slate-500">dní</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      Predvolené: 7 dní • Maximum: 365 dní
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Čo sa bude sťahovať:</h4>
                    <ul className="text-sm text-slate-500 space-y-1">
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Hodinové odpočty vodomera
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Stav meradla (m³)
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Teplota vody (ak je dostupná)
                      </li>
                    </ul>
                    <p className="text-xs text-slate-400 mt-3">
                      Zdroj: api.vas.sk (Vodárenská spoločnosť)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {syncProgress.status === 'running' ? (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-slate-700 font-medium">{syncProgress.message}</p>
                    </div>
                  ) : syncProgress.status === 'success' ? (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <p className="text-green-700 font-medium">{syncProgress.message}</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </div>
                      <p className="text-red-700 font-medium">{syncProgress.message}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-4">
                    <ul className="text-sm text-slate-600 space-y-1">
                      {syncProgress.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              {!syncProgress ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSyncModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                  >
                    Zrušiť
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                    </svg>
                    Synchronizovať
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowSyncModal(false);
                    setSyncProgress(null);
                  }}
                  className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  Zavrieť
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sync History component
function SyncHistory({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">Žiadna história</h3>
        <p className="text-slate-500">Zatiaľ nebola vykonaná žiadna synchronizácia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">História synchronizácií</h2>
        <span className="text-sm text-slate-500">{logs.length} záznamov</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {logs.map((log, idx) => (
            <div key={log.id || idx} className="p-4 hover:bg-slate-50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    log.status === 'success' 
                      ? 'bg-green-100' 
                      : log.status === 'error' 
                        ? 'bg-red-100' 
                        : 'bg-blue-100'
                  }`}>
                    {log.status === 'success' ? (
                      <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : log.status === 'error' ? (
                      <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">
                      {log.status === 'success' 
                        ? `Synchronizované ${log.records_synced || 0} záznamov`
                        : log.status === 'error'
                          ? 'Synchronizácia zlyhala'
                          : 'Prebieha synchronizácia...'
                      }
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {new Date(log.started_at).toLocaleString('sk-SK')}
                      {log.completed_at && (
                        <> • Trvanie: {Math.round((new Date(log.completed_at) - new Date(log.started_at)) / 1000)}s</>
                      )}
                    </div>
                    {log.error_message && (
                      <div className="text-sm text-red-600 mt-1">{log.error_message}</div>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  log.status === 'success'
                    ? 'bg-green-100 text-green-700'
                    : log.status === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                }`}>
                  {log.status === 'success' ? 'Úspešne' : log.status === 'error' ? 'Chyba' : 'Prebieha'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
