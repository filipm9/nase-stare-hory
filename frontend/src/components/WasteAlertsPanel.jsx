import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';

const WASTE_TYPES = {
  komunal: { label: 'Komunálny', icon: '🗑️', color: 'slate' },
  plast: { label: 'Plasty', icon: '♻️', color: 'yellow' },
  papier: { label: 'Papier', icon: '📄', color: 'blue' },
};

export default function WasteAlertsPanel({ onCountChange, setConfirmDialog, showToast }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Check modal
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [sendingTest, setSendingTest] = useState(false);
  
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
      showToast?.('Nepodarilo sa načítať notifikácie', 'error');
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
      showToast?.('Email bol pridaný');
    } catch (err) {
      showToast?.('Nepodarilo sa prihlásiť: ' + err.message, 'error');
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
            showToast?.('Email bol odstránený');
          } catch (err) {
            showToast?.('Nepodarilo sa odstrániť email', 'error');
          }
        },
      });
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getWasteAlerts();
      setAlerts(data);
      
      const count = await api.getWasteUnreadCount();
      onCountChange?.(count.count);
    } catch (err) {
      showToast?.('Nepodarilo sa načítať alerty', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCheckModal = () => {
    setShowCheckModal(true);
    setCheckResult(null);
    handleCheck();
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await api.checkWaste();
      setCheckResult(result);
      if (result.alert) {
        await loadAlerts();
      }
    } catch (err) {
      setCheckResult({ error: err.message });
    } finally {
      setChecking(false);
    }
  };

  const handleSendTestAlert = async () => {
    setSendingTest(true);
    try {
      await api.createTestWasteAlert();
      await loadAlerts();
      showToast?.('Testovací alert bol vytvorený a email odoslaný');
    } catch (err) {
      showToast?.('Nepodarilo sa vytvoriť testovací alert: ' + err.message, 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markWasteAlertRead(id);
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
      
      const count = await api.getWasteUnreadCount();
      onCountChange?.(count.count);
    } catch (err) {
      showToast?.('Nepodarilo sa označiť ako prečítané', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllWasteAlertsRead();
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      onCountChange?.(0);
    } catch (err) {
      showToast?.('Nepodarilo sa označiť všetky ako prečítané', 'error');
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
            await api.deleteWasteAlert(id);
            setAlerts(alerts.filter(a => a.id !== id));
            
            const count = await api.getWasteUnreadCount();
            onCountChange?.(count.count);
          } catch (err) {
            showToast?.('Nepodarilo sa zmazať alert', 'error');
          }
        },
      });
    }
  };

  const getWasteTypesFromAlert = (wasteTypeStr) => {
    if (!wasteTypeStr) return [];
    return wasteTypeStr.split(',').filter(Boolean);
  };

  const filteredAlerts = filter === 'unread' 
    ? alerts.filter(a => !a.is_read)
    : alerts;

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Alerty vývozu odpadu</h2>
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
              Označiť všetky
            </button>
          )}

          <button
            onClick={handleOpenCheckModal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            Skontrolovať
          </button>

          <button
            onClick={() => setShowSubscriptions(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition flex items-center gap-2"
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
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">🗑️</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Žiadne alerty</h3>
          <p className="text-slate-500">
            {filter === 'unread' 
              ? 'Žiadne neprečítané alerty'
              : 'Zatiaľ neboli vytvorené žiadne alerty vývozu odpadu.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const wasteTypes = getWasteTypesFromAlert(alert.waste_type);
            
            return (
              <div
                key={alert.id}
                className={`rounded-2xl p-5 border transition ${
                  alert.is_read 
                    ? 'bg-white border-slate-100' 
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${
                      alert.is_read ? 'bg-slate-100' : 'bg-emerald-100'
                    }`}>
                      🚛
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {wasteTypes.map(type => {
                          const typeInfo = WASTE_TYPES[type];
                          return typeInfo ? (
                            <span key={type} className={`px-1.5 py-0.5 text-[10px] font-medium rounded bg-${typeInfo.color}-100 text-${typeInfo.color}-700`}>
                              {typeInfo.icon} {typeInfo.label}
                            </span>
                          ) : null;
                        })}
                        <h3 className={`font-semibold ${alert.is_read ? 'text-slate-800' : 'text-emerald-800'}`}>
                          Pripomienka vývozu
                        </h3>
                        {!alert.is_read && (
                          <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-semibold rounded-md uppercase">
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
                        {alert.pickup_date && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>Vývoz: {formatPickupDate(alert.pickup_date)}</span>
                          </>
                        )}
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

      {/* Check Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Kontrola vývozov</h3>
                  <p className="text-sm text-slate-500">Kontrola zajtraších vývozov odpadu</p>
                </div>
                <button
                  onClick={() => setShowCheckModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {checking ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-600">Kontrolujem vývozy...</p>
                </div>
              ) : checkResult?.error ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium">Kontrola zlyhala</p>
                  <p className="text-sm text-slate-500 mt-2">{checkResult.error}</p>
                </div>
              ) : checkResult ? (
                <div className="space-y-6">
                  {/* Result summary */}
                  <div className={`p-4 rounded-xl ${
                    checkResult.alert 
                      ? 'bg-emerald-50 border border-emerald-200' 
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {checkResult.alert || checkResult.pickups > 0 ? (
                        <>
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="text-xl">🚛</span>
                          </div>
                          <div>
                            <p className="font-medium text-emerald-800">
                              {checkResult.alert ? 'Alert vytvorený!' : `${checkResult.pickups} vývozov zajtra`}
                            </p>
                            <p className="text-sm text-emerald-600">
                              {checkResult.notified ? 'Email bol odoslaný.' : 'Email nebol odoslaný (už bol odoslaný skôr).'}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">Žiadne vývozy zajtra</p>
                            <p className="text-sm text-slate-500">Najbližší vývoz nájdete v kalendári.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Types for tomorrow */}
                  {checkResult.types && checkResult.types.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-3">Zajtra sa vyváža:</h4>
                      <div className="flex flex-wrap gap-2">
                        {checkResult.types.map(type => {
                          const typeInfo = WASTE_TYPES[type];
                          return typeInfo ? (
                            <div key={type} className={`px-3 py-2 rounded-xl bg-${typeInfo.color}-100 text-${typeInfo.color}-700 flex items-center gap-2`}>
                              <span className="text-lg">{typeInfo.icon}</span>
                              <span className="font-medium">{typeInfo.label}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button
                onClick={handleSendTestAlert}
                disabled={sendingTest}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {sendingTest ? 'Posielam...' : 'Poslať testovací alert'}
              </button>
              <button
                onClick={() => setShowCheckModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
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
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Email notifikácie</h3>
                  <p className="text-sm text-slate-500">Nastavenia pre celú aplikáciu</p>
                </div>
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
              <p className="text-sm text-slate-500 mb-4">
                Emaily dostávajú všetky alerty z celej aplikácie (voda, sneh, odpad).
              </p>
              
              {/* Add email form */}
              <form onSubmit={handleSubscribe} className="flex gap-2 mb-6">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50"
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
                </div>
              ) : (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

function formatPickupDate(dateStr) {
  try {
    const date = parseISO(dateStr);
    return format(date, 'd. MMMM yyyy', { locale: sk });
  } catch {
    return dateStr;
  }
}
