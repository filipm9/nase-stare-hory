import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';

const ALERT_TYPES = {
  night_consumption: {
    label: 'Nočná spotreba',
    icon: '🌙',
    color: 'purple',
    description: 'Detekovaná spotreba vody v nočných hodinách (2-5h)',
  },
  sudden_spike: {
    label: 'Náhly skok',
    icon: '📈',
    color: 'red',
    description: 'Spotreba výrazne vyššia ako obvykle',
  },
  continuous_flow: {
    label: 'Nepretržitý prietok',
    icon: '🚰',
    color: 'orange',
    description: 'Voda tečie nepretržite dlhú dobu',
  },
  high_daily: {
    label: 'Vysoká denná spotreba',
    icon: '📊',
    color: 'amber',
    description: 'Dnešná spotreba výrazne vyššia ako mesačný priemer',
  },
  freezing_risk: {
    label: 'Riziko zamrznutia',
    icon: '🥶',
    color: 'blue',
    description: 'Teplota vody príliš nízka',
  },
};

const colorClasses = {
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
  },
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
};

export default function AlertsPanel({ onCountChange, setConfirmDialog }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread
  const [detectionResult, setDetectionResult] = useState(null);
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  
  // Subscriptions
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  useEffect(() => {
    if (showSubscriptions) {
      loadSubscriptions();
    }
  }, [showSubscriptions]);

  const loadSubscriptions = async () => {
    try {
      const data = await api.getSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error('Load subscriptions error:', err);
    }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!newEmail) return;
    
    setSubscribing(true);
    try {
      await api.subscribe(newEmail);
      setNewEmail('');
      await loadSubscriptions();
    } catch (err) {
      console.error('Subscribe error:', err);
      alert('Nepodarilo sa prihlásiť: ' + err.message);
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = (id) => {
    if (setConfirmDialog) {
      setConfirmDialog({
        title: 'Odstrániť email',
        message: 'Naozaj chcete odstrániť tento email z notifikácií?',
        confirmText: 'Odstrániť',
        onConfirm: async () => {
          try {
            await api.unsubscribe(id);
            await loadSubscriptions();
          } catch (err) {
            console.error('Unsubscribe error:', err);
          }
        },
      });
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? { unreadOnly: 'true' } : {};
      const data = await api.getAlerts(params);
      setAlerts(data);
      
      const count = await api.getUnreadCount();
      onCountChange?.(count.count);
    } catch (err) {
      console.error('Load alerts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markAlertRead(id);
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
      
      const count = await api.getUnreadCount();
      onCountChange?.(count.count);
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllAlertsRead();
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      onCountChange?.(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleDelete = (id) => {
    if (setConfirmDialog) {
      setConfirmDialog({
        title: 'Zmazať alert',
        message: 'Naozaj chcete zmazať tento alert?',
        confirmText: 'Zmazať',
        onConfirm: async () => {
          try {
            await api.deleteAlert(id);
            setAlerts(alerts.filter(a => a.id !== id));
            
            const count = await api.getUnreadCount();
            onCountChange?.(count.count);
          } catch (err) {
            console.error('Delete error:', err);
          }
        },
      });
    }
  };

  const handleDetectLeaks = async () => {
    setDetecting(true);
    setShowDetectionModal(true);
    setDetectionResult(null);
    try {
      const result = await api.detectLeaks();
      setDetectionResult(result);
      await loadAlerts();
    } catch (err) {
      console.error('Detect leaks error:', err);
      setDetectionResult({ error: err.message });
    } finally {
      setDetecting(false);
    }
  };

  const handleCreateTestAlert = async () => {
    setCreatingTest(true);
    try {
      await api.createTestAlert();
      await loadAlerts();
    } catch (err) {
      console.error('Create test alert error:', err);
      alert('Nepodarilo sa vytvoriť testovací alert: ' + err.message);
    } finally {
      setCreatingTest(false);
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Alerty</h2>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} neprečítaných` : 'Všetky alerty prečítané'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                filter === 'all'
                  ? 'bg-white shadow text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Všetky
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                filter === 'unread'
                  ? 'bg-white shadow text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Neprečítané
            </button>
          </div>

          {/* Actions */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
            >
              Označiť všetky ako prečítané
            </button>
          )}

          <button
            onClick={handleDetectLeaks}
            disabled={detecting}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${detecting ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {detecting ? 'Kontrolujem...' : 'Skontrolovať'}
          </button>

          <button
            onClick={() => setShowSubscriptions(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition flex items-center gap-2"
            title="Notifikačné nastavenia"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Email
          </button>
        </div>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/4 mb-3"></div>
              <div className="h-4 bg-slate-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Všetko v poriadku</h3>
          <p className="text-slate-500">
            {filter === 'unread' 
              ? 'Žiadne neprečítané alerty'
              : 'Žiadne alerty. Váš vodomer funguje normálne.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const alertType = ALERT_TYPES[alert.alert_type] || {
              label: alert.alert_type,
              icon: '⚠️',
              color: 'amber',
            };
            const colors = colorClasses[alertType.color];

            return (
              <div
                key={alert.id}
                className={`rounded-2xl p-5 border transition ${
                  alert.is_read 
                    ? 'bg-white border-slate-100' 
                    : `${colors.bg} ${colors.border}`
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${
                      alert.is_read ? 'bg-slate-100' : colors.badge
                    }`}>
                      {alertType.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className={`font-semibold ${alert.is_read ? 'text-slate-800' : colors.text}`}>
                          {alertType.label}
                        </h3>
                        {!alert.is_read && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-md uppercase">
                            Nový
                          </span>
                        )}
                        {alert.email_sent && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-md">
                            Email odoslaný
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 mb-2">{alert.message}</p>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span>{formatDate(alert.created_at)}</span>
                        {alert.address && <span className="text-slate-300">•</span>}
                        {alert.address && <span>{alert.address}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Označiť ako prečítané"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Zmazať"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detection Modal */}
      {showDetectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  Kontrola úniku vody
                </h3>
                <button
                  onClick={() => setShowDetectionModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {detecting ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600">Kontrolujem spotrebu vody...</p>
                  <p className="text-sm text-slate-400 mt-2">Analyzujem dáta za posledných 24 hodín</p>
                </div>
              ) : detectionResult?.error ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium">Kontrola zlyhala</p>
                  <p className="text-sm text-slate-500 mt-2">{detectionResult.error}</p>
                </div>
              ) : detectionResult ? (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className={`p-4 rounded-xl ${
                    detectionResult.alerts?.length > 0 
                      ? 'bg-amber-50 border border-amber-200' 
                      : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {detectionResult.alerts?.length > 0 ? (
                        <>
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-amber-800">
                              Detekovaných {detectionResult.alerts.length} problémov
                            </p>
                            <p className="text-sm text-amber-600">
                              Odporúčame skontrolovať spotrebu
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-green-800">Všetko v poriadku</p>
                            <p className="text-sm text-green-600">Neboli detekované žiadne problémy</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Checks performed */}
                  {detectionResult.checksPerformed?.map((meterChecks, idx) => (
                    <div key={idx} className="space-y-3">
                      <h4 className="font-medium text-slate-700">{meterChecks.meter}</h4>
                      <div className="space-y-2">
                        {meterChecks.checks.map((check, checkIdx) => (
                          <div 
                            key={checkIdx}
                            className={`p-4 rounded-lg border ${
                              check.status === 'warning' 
                                ? 'bg-amber-50 border-amber-200' 
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`w-2 h-2 rounded-full ${
                                    check.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'
                                  }`}></span>
                                  <span className="font-medium text-slate-800">{check.name}</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-2">{check.description}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                  <span className="text-slate-600">
                                    <span className="text-slate-400">Aktuálne:</span> {check.currentValue}
                                  </span>
                                  {check.avgValue && (
                                    <span className="text-slate-600">
                                      <span className="text-slate-400">{check.avgValue}</span>
                                    </span>
                                  )}
                                  <span className="text-slate-600">
                                    <span className="text-slate-400">Limit:</span> {check.threshold}
                                  </span>
                                </div>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                check.status === 'warning' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {check.status === 'warning' ? 'Prekročené' : 'OK'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {detectionResult.timestamp && (
                    <p className="text-sm text-slate-400 text-center">
                      Skontrolované: {new Date(detectionResult.timestamp).toLocaleString('sk-SK')}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowDetectionModal(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                Zavrieť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Modal */}
      {showSubscriptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  Notifikačné nastavenia
                </h3>
                <button
                  onClick={() => setShowSubscriptions(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Test Alert Section */}
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-800">Testovací alert</h4>
                    <p className="text-sm text-slate-500">Vytvoriť testovací alert pre overenie notifikácií</p>
                  </div>
                  <button
                    onClick={handleCreateTestAlert}
                    disabled={creatingTest}
                    className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    {creatingTest ? 'Vytváram...' : 'Vytvoriť'}
                  </button>
                </div>
              </div>

              {/* Email Subscriptions Section */}
              <h4 className="font-medium text-slate-800 mb-2">Email notifikácie</h4>
              <p className="text-slate-600 mb-4">
                Pridajte emaily, ktoré budú dostávať notifikácie o alertoch.
              </p>
              
              {/* Add email form */}
              <form onSubmit={handleSubscribe} className="flex gap-2 mb-6">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {subscribing ? 'Pridávam...' : 'Pridať'}
                </button>
              </form>

              {/* Subscriptions list */}
              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <p>Žiadne prihlásené emaily</p>
                  <p className="text-sm mt-1">Pridajte email pre prijímanie notifikácií</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </div>
                        <span className="text-slate-700">{sub.email}</span>
                      </div>
                      <button
                        onClick={() => handleUnsubscribe(sub.id)}
                        className="p-2 text-slate-400 hover:text-red-600 transition"
                        title="Odstrániť"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowSubscriptions(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                Zavrieť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  try {
    const date = parseISO(dateStr);
    return format(date, 'd. MMMM yyyy, HH:mm', { locale: sk });
  } catch {
    return dateStr;
  }
}
