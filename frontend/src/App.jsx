import { useState, useEffect } from 'react';
import { api } from './api/client';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    // Check session on mount
    api.getMe()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      // Ignore errors
    }
    setAuthenticated(false);
  };

  // Loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="text-slate-500">Načítavam...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}
