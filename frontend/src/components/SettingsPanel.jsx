import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function SettingsPanel() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Create user form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, meData] = await Promise.all([
        api.getUsers(),
        api.getMe(),
      ]);
      setUsers(usersData);
      setCurrentUser(meData.user);
    } catch (err) {
      console.error('Load settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Heslá sa nezhodujú');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Heslo musí mať aspoň 6 znakov');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Heslo bolo úspešne zmenené');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (newUserPassword.length < 6) {
      setCreateError('Heslo musí mať aspoň 6 znakov');
      return;
    }

    setCreatingUser(true);
    try {
      await api.createUser(newUserEmail, newUserPassword);
      setCreateSuccess(`Používateľ ${newUserEmail} bol vytvorený`);
      setNewUserEmail('');
      setNewUserPassword('');
      await loadData();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Naozaj chcete zmazať používateľa ${user.email}?`)) {
      return;
    }

    try {
      await api.deleteUser(user.id);
      await loadData();
    } catch (err) {
      alert('Chyba pri mazaní: ' + err.message);
    }
  };

  const loadDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const data = await api.getDiagnostics();
      setDiagnostics(data);
    } catch (err) {
      console.error('Diagnostics error:', err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-10 bg-slate-100 rounded mb-3"></div>
          <div className="h-10 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Zmena hesla</h2>
        
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">
              {passwordSuccess}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Aktuálne heslo
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nové heslo
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Potvrďte nové heslo
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {changingPassword ? 'Mením...' : 'Zmeniť heslo'}
          </button>
        </form>
      </div>

      {/* Create User */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Vytvoriť nového používateľa</h2>
        
        <form onSubmit={handleCreateUser} className="space-y-4 max-w-md">
          {createError && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {createError}
            </div>
          )}
          {createSuccess && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">
              {createSuccess}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="novy@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Heslo
            </label>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={creatingUser}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {creatingUser ? 'Vytváram...' : 'Vytvoriť používateľa'}
          </button>
        </form>
      </div>

      {/* User List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Používatelia</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Vytvorený</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4">
                    <span className="text-slate-800">{user.email}</span>
                    {currentUser?.id === user.id && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Vy
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-sm">
                    {new Date(user.created_at).toLocaleDateString('sk-SK')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {currentUser?.id !== user.id && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Zmazať
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Diagnostika dát</h2>
          <button
            onClick={loadDiagnostics}
            disabled={loadingDiagnostics}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
          >
            {loadingDiagnostics ? 'Načítavam...' : 'Skontrolovať'}
          </button>
        </div>
        
        {diagnostics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-slate-800">{diagnostics.totalReadings}</div>
                <div className="text-sm text-slate-500">Celkom záznamov</div>
              </div>
              <div className={`rounded-lg p-4 ${diagnostics.readingsWithTemperature > 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className={`text-2xl font-bold ${diagnostics.readingsWithTemperature > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {diagnostics.readingsWithTemperature}
                </div>
                <div className={`text-sm ${diagnostics.readingsWithTemperature > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  S teplotou
                </div>
              </div>
            </div>

            {diagnostics.dateRange && (
              <div className="text-sm text-slate-500">
                Dáta od <strong>{new Date(diagnostics.dateRange.oldest).toLocaleDateString('sk-SK')}</strong> do{' '}
                <strong>{new Date(diagnostics.dateRange.newest).toLocaleDateString('sk-SK')}</strong>
              </div>
            )}

            {diagnostics.readingsWithTemperature === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <div className="font-medium text-amber-800">Teplota nie je dostupná</div>
                    <div className="text-sm text-amber-600">
                      VAS API neposiela údaje o teplote pre váš vodomer. 
                      Checkbox pre teplotu v grafe sa preto nezobrazuje.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {diagnostics.recentReadings?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Posledné záznamy:</h3>
                <div className="bg-slate-50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left py-2 px-3 text-slate-600">Dátum</th>
                        <th className="text-right py-2 px-3 text-slate-600">Stav (m³)</th>
                        <th className="text-right py-2 px-3 text-slate-600">Teplota (°C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.recentReadings.map((r, i) => (
                        <tr key={i} className="border-t border-slate-200">
                          <td className="py-2 px-3 text-slate-700">
                            {new Date(r.reading_date).toLocaleString('sk-SK')}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700">
                            {parseFloat(r.state).toFixed(3)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {r.heat !== null ? (
                              <span className="text-green-600">{r.heat}°C</span>
                            ) : (
                              <span className="text-slate-400">—</span>
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

        {!diagnostics && (
          <p className="text-slate-500 text-sm">
            Kliknite na "Skontrolovať" pre zobrazenie informácií o dátach v databáze.
          </p>
        )}
      </div>
    </div>
  );
}
