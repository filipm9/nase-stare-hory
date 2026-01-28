const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 429) {
    throw new Error('Too many requests. Please wait a moment.');
  }

  if (res.status === 401) {
    // Only redirect for non-auth-check requests to avoid infinite loops
    if (!path.includes('/auth/me')) {
      window.location.href = '/';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email, password) => 
    request('/auth/login', { 
      method: 'POST', 
      body: JSON.stringify({ email, password }) 
    }),
  
  logout: () => request('/auth/logout', { method: 'POST' }),
  
  getMe: () => request('/auth/me'),
  
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  
  // User management
  getUsers: () => request('/auth/users'),
  
  createUser: (email, password) =>
    request('/auth/users', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Meters
  getMeters: () => request('/water/meters'),
  
  getReadings: (meterId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/water/meters/${meterId}/readings${query ? `?${query}` : ''}`);
  },
  
  getStats: (meterId) => request(`/water/meters/${meterId}/stats`),

  // Sync
  sync: () => request('/water/sync', { method: 'POST' }),
  
  syncHistorical: (days = 90) => 
    request('/water/sync/historical', { 
      method: 'POST', 
      body: JSON.stringify({ days }) 
    }),
  
  getSyncLogs: () => request('/water/sync-logs'),
  
  detectLeaks: () => request('/water/detect-leaks', { method: 'POST' }),

  // Alerts
  getAlerts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/alerts${query ? `?${query}` : ''}`);
  },
  
  getUnreadCount: () => request('/alerts/unread-count'),
  
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
  
  markAllAlertsRead: () => request('/alerts/read-all', { method: 'PATCH' }),
  
  deleteAlert: (id) => request(`/alerts/${id}`, { method: 'DELETE' }),
  
  getAlertStats: () => request('/alerts/stats'),
  
  createTestAlert: () => request('/alerts/test', { method: 'POST' }),
  
  getDiagnostics: () => request('/water/diagnostics'),
  
  // Alert subscriptions
  getSubscriptions: () => request('/alerts/subscriptions'),
  
  subscribe: (email) => 
    request('/alerts/subscriptions', { 
      method: 'POST', 
      body: JSON.stringify({ email }) 
    }),
  
  unsubscribe: (id) => request(`/alerts/subscriptions/${id}`, { method: 'DELETE' }),
};
