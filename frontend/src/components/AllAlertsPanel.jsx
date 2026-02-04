import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';

const ALERT_CONFIG = {
  // Water alerts
  sudden_spike: {
    label: 'Náhly skok',
    icon: '📈',
    color: 'red',
    module: 'water',
  },
  continuous_flow: {
    label: 'Nepretržitý prietok',
    icon: '🚰',
    color: 'orange',
    module: 'water',
  },
  high_daily: {
    label: 'Vysoká denná spotreba',
    icon: '📊',
    color: 'amber',
    module: 'water',
  },
  freezing_risk: {
    label: 'Riziko zamrznutia',
    icon: '🥶',
    color: 'blue',
    module: 'water',
  },
  // Snow alerts
  snow_warning: {
    label: 'Sneženie',
    icon: '❄️',
    color: 'blue',
    module: 'snow',
  },
  // Waste alerts
  pickup_reminder: {
    label: 'Vývoz odpadu',
    icon: '🚛',
    color: 'emerald',
    module: 'waste',
  },
};

const colorClasses = {
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
  },
};

const moduleLabels = {
  water: { label: 'Voda', color: 'bg-cyan-100 text-cyan-700' },
  snow: { label: 'Sneh', color: 'bg-blue-100 text-blue-700' },
  waste: { label: 'Odpad', color: 'bg-emerald-100 text-emerald-700' },
};

export default function AllAlertsPanel({ onClose, onCountChange, onNavigateToModule, showToast }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? { unreadOnly: 'true' } : {};
      const data = await api.getAllAlerts(params);
      setAlerts(data);
      
      const count = await api.getAllUnreadCount();
      onCountChange?.(count.count);
    } catch (err) {
      showToast?.('Nepodarilo sa načítať alerty', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (alert) => {
    try {
      if (alert.module === 'water') {
        await api.markAlertRead(alert.id);
      } else if (alert.module === 'snow') {
        await api.markSnowAlertRead(alert.id);
      } else if (alert.module === 'waste') {
        await api.markWasteAlertRead(alert.id);
      }
      setAlerts(alerts.map(a => 
        (a.id === alert.id && a.module === alert.module) ? { ...a, is_read: true } : a
      ));
      
      const count = await api.getAllUnreadCount();
      onCountChange?.(count.count);
    } catch (err) {
      showToast?.('Nepodarilo sa označiť ako prečítané', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Mark all alerts as read from all modules
      await Promise.all([
        api.markAllAlertsRead(),
        api.markAllSnowAlertsRead(),
        api.markAllWasteAlertsRead(),
      ]);
      
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      onCountChange?.(0);
    } catch (err) {
      showToast?.('Nepodarilo sa označiť všetky ako prečítané', 'error');
    }
  };

  const handleGoToModule = (module) => {
    onClose();
    onNavigateToModule?.(module);
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Všetky alerty</h3>
              <p className="text-sm text-slate-500">
                {unreadCount > 0 ? `${unreadCount} neprečítaných` : 'Všetky alerty prečítané'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 text-xs rounded-md transition ${
                    filter === 'all'
                      ? 'bg-white shadow text-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Všetky
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 text-xs rounded-md transition ${
                    filter === 'unread'
                      ? 'bg-white shadow text-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Neprečítané
                </button>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Prečítať všetky
                </button>
              )}
              
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Alerts list */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Všetko v poriadku</h3>
              <p className="text-slate-500 text-sm">
                {filter === 'unread' 
                  ? 'Žiadne neprečítané alerty'
                  : 'Žiadne alerty zo žiadneho modulu'
                }
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {alerts.map((alert) => {
                const alertConfig = ALERT_CONFIG[alert.alert_type] || {
                  label: alert.alert_type,
                  icon: '⚠️',
                  color: 'amber',
                  module: alert.module,
                };
                const colors = colorClasses[alertConfig.color];
                const moduleInfo = moduleLabels[alert.module];

                return (
                  <div
                    key={`${alert.module}-${alert.id}`}
                    className={`rounded-xl p-4 border transition ${
                      alert.is_read 
                        ? 'bg-white border-slate-100' 
                        : `${colors.bg} ${colors.border}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                          alert.is_read ? 'bg-slate-100' : colors.badge
                        }`}>
                          {alertConfig.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${moduleInfo.color}`}>
                              {moduleInfo.label}
                            </span>
                            <h4 className={`font-medium text-sm ${alert.is_read ? 'text-slate-700' : colors.text}`}>
                              {alertConfig.label}
                            </h4>
                            {!alert.is_read && (
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-semibold rounded uppercase">
                                Nový
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{alert.message}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                            <span>{formatDate(alert.created_at)}</span>
                            {alert.address && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="truncate">{alert.address}</span>
                              </>
                            )}
                            {alert.snowfall_cm && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>{alert.snowfall_cm}cm snehu</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!alert.is_read && (
                          <button
                            onClick={() => handleMarkRead(alert)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Označiť ako prečítané"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleGoToModule(alert.module)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          title="Prejsť na modul"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - quick links to modules */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-2">
            <button
              onClick={() => handleGoToModule('water')}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-2"
            >
              <span>💧</span>
              Voda
            </button>
            <button
              onClick={() => handleGoToModule('snow')}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-2"
            >
              <span>❄️</span>
              Sneh
            </button>
            <button
              onClick={() => handleGoToModule('waste')}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-2"
            >
              <span>🚛</span>
              Odpad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  try {
    const date = parseISO(dateStr);
    return format(date, 'd. MMM, HH:mm', { locale: sk });
  } catch {
    return dateStr;
  }
}
