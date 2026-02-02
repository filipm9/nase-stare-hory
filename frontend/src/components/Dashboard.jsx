import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import ConsumptionChart from './ConsumptionChart';
import AlertsPanel from './AlertsPanel';
import StatsCards from './StatsCards';
import SettingsPanel from './SettingsPanel';
import SyncHistory from './SyncHistory';
import WaterDiagnostics from './WaterDiagnostics';

export default function Dashboard({ onLogout, showToast }) {
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
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [metersData, countData, logsData] = await Promise.all([
        api.getMeters(),
        api.getUnreadCount(),
        api.getSyncLogs(),
      ]);
      
      setMeters(metersData);
      setUnreadCount(countData.count);
      setSyncLogs(logsData);
      
      return metersData;
    } catch (err) {
      const errorMessage = err.message || 'Nepodarilo sa načítať dáta';
      setError(errorMessage);
      showToast?.(errorMessage, 'error');
      return [];
    }
  }, [showToast]);

  const loadStats = useCallback(async (meterId) => {
    try {
      const statsData = await api.getStats(meterId);
      setStats(statsData);
    } catch (err) {
      showToast?.('Nepodarilo sa načítať štatistiky', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadData().then((metersData) => {
      if (metersData.length > 0) {
        setSelectedMeter(metersData[0]);
      }
    });
  }, [loadData]);

  useEffect(() => {
    if (selectedMeter) {
      loadStats(selectedMeter.meter_id);
    }
  }, [selectedMeter, loadStats]);

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
      const metersData = await loadData();
      if (selectedMeter) {
        await loadStats(selectedMeter.meter_id);
      } else if (metersData.length > 0) {
        setSelectedMeter(metersData[0]);
      }
    } catch (err) {
      setSyncProgress({
        status: 'error',
        message: 'Synchronizácia zlyhala',
        details: [err.message],
      });
      showToast?.('Synchronizácia zlyhala: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <button 
              onClick={() => setActiveTab('consumption')}
              className="flex items-center gap-3 hover:opacity-80 transition"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <h1 className="hidden sm:block text-lg font-semibold text-slate-800">Staré Hory</h1>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {/* Alerts badge */}
              <button
                onClick={() => setActiveTab('alerts')}
                className={`relative p-2 rounded-lg transition ${
                  activeTab === 'alerts'
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title="Alerty"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              {/* Account */}
              <button
                onClick={() => setShowAccountModal(true)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Účet"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </button>

              {/* Logout */}
              <button
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Odhlásiť"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Module selector - water meter */}
        {selectedMeter && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Moduly</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* Water module - active */}
              <div className="flex-shrink-0 bg-white rounded-2xl border-2 border-cyan-500/30 shadow-sm p-4 min-w-[240px] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none" />
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
                      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleOpenSyncModal}
                      disabled={syncing}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition disabled:opacity-50"
                      title="Synchronizovať"
                    >
                      <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setActiveTab('water-settings')}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition"
                      title="Nastavenia vodomera"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Vodomer</p>
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">Online</span>
                  </div>
                  <p className="text-xl font-semibold text-slate-800">
                    {parseFloat(selectedMeter.latest_state)?.toFixed(2) || '—'} <span className="text-sm font-normal text-slate-400">m³</span>
                  </p>
                  {selectedMeter.latest_reading && (
                    <p className="text-xs text-slate-400">
                      {new Date(selectedMeter.latest_reading).toLocaleString('sk-SK', { 
                        day: 'numeric', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Future modules placeholder */}
              <div className="flex-shrink-0 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4 min-w-[160px] flex flex-col items-center justify-center text-center cursor-default">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <p className="text-xs text-slate-400">Ďalšie moduly<br/>čoskoro</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6">
          <nav className="flex p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('consumption')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition ${
                activeTab === 'consumption'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Spotreba
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 ${
                activeTab === 'alerts'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Alerty
              {unreadCount > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                  activeTab === 'alerts'
                    ? 'bg-white/20 text-white'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              História
            </button>
            <button
              onClick={() => setActiveTab('water-settings')}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition ${
                activeTab === 'water-settings'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Diagnostika
            </button>
          </nav>
        </div>

        {/* Content */}
        {meters.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Žiadne dáta</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">Synchronizujte dáta z VAS API pre načítanie informácií o vašom vodomere</p>
            <button
              onClick={handleOpenSyncModal}
              disabled={syncing}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50 shadow-sm"
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
          <AlertsPanel onCountChange={setUnreadCount} setConfirmDialog={setConfirmDialog} showToast={showToast} />
        ) : activeTab === 'history' ? (
          <SyncHistory logs={syncLogs} />
        ) : activeTab === 'water-settings' ? (
          <WaterDiagnostics />
        ) : null}
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 pb-0">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Synchronizácia
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Stiahnutie dát z VAS API</p>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 pb-6">
              {!syncProgress ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Počet dní na stiahnutie
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={syncDays}
                        onChange={(e) => setSyncDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 7)))}
                        min="1"
                        max="365"
                        className="w-24 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                      />
                      <span className="text-slate-500">dní</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Predvolené: 7 dní • Maximum: 365 dní
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Čo sa bude sťahovať:</h4>
                    <ul className="text-sm text-slate-500 space-y-2">
                      <li className="flex items-center gap-2.5">
                        <div className="w-5 h-5 bg-cyan-100 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        Hodinové odpočty vodomera
                      </li>
                      <li className="flex items-center gap-2.5">
                        <div className="w-5 h-5 bg-cyan-100 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        Stav meradla (m³)
                      </li>
                      <li className="flex items-center gap-2.5">
                        <div className="w-5 h-5 bg-cyan-100 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        Teplota vody (ak je dostupná)
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {syncProgress.status === 'running' ? (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-5"></div>
                      <p className="text-slate-700 font-medium">{syncProgress.message}</p>
                    </div>
                  ) : syncProgress.status === 'success' ? (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <p className="text-emerald-700 font-semibold">{syncProgress.message}</p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <svg className="w-7 h-7 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </div>
                      <p className="text-red-700 font-semibold">{syncProgress.message}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-2xl p-4">
                    <ul className="text-sm text-slate-600 space-y-1.5">
                      {syncProgress.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              {!syncProgress ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSyncModal(false)}
                    className="flex-1 px-4 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200"
                  >
                    Zrušiť
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full px-4 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200"
                >
                  Zavrieť
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Účet</h3>
                    <p className="text-sm text-slate-500">Správa používateľov a hesiel</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SettingsPanel setConfirmDialog={setConfirmDialog} />
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
                {confirmDialog.title || 'Potvrdenie'}
              </h3>
              <p className="text-slate-600 text-center">
                {confirmDialog.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  confirmDialog.onCancel?.();
                  setConfirmDialog(null);
                }}
                className="flex-1 px-4 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition border border-slate-200"
              >
                Zrušiť
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition"
              >
                {confirmDialog.confirmText || 'Potvrdiť'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
