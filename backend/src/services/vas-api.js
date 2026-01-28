import { config } from '../config.js';

let cachedToken = null;
let tokenExpiresAt = null;

export function clearToken() {
  cachedToken = null;
  tokenExpiresAt = null;
}

export async function getToken(forceRefresh = false) {
  // Return cached token if still valid (with 5 min buffer)
  if (!forceRefresh && cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const response = await fetch(`${config.vas.apiUrl}/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: config.vas.username,
      password: config.vas.password,
      client_id: config.vas.clientId,
      client_secret: config.vas.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`VAS API token error: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

// Helper to make authenticated requests with auto-retry on 401
async function authenticatedFetch(url, options = {}, retried = false) {
  const token = await getToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // On 401, refresh token and retry once
  if (response.status === 401 && !retried) {
    console.log('VAS API 401, refreshing token and retrying...');
    clearToken();
    return authenticatedFetch(url, options, true);
  }

  return response;
}

export async function getCustomerData() {
  const response = await authenticatedFetch(
    `${config.vas.apiUrl}/api/SmartData/CustomerData`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`VAS API CustomerData error: ${response.status}`);
  }

  return response.json();
}

export async function getProfileData(meterId, dateFrom, dateTo) {
  const params = new URLSearchParams({
    METERID: meterId.toString(),
    dateFrom: formatDate(dateFrom),
    dateTo: formatDate(dateTo),
  });

  const response = await authenticatedFetch(
    `${config.vas.apiUrl}/api/SmartData/ProfileData?${params}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`VAS API ProfileData error: ${response.status}`);
  }

  return response.json();
}

export async function getAlertData(meterId, dateFrom, dateTo) {
  const params = new URLSearchParams({
    METERID: meterId.toString(),
    dateFrom: formatDate(dateFrom),
    dateTo: formatDate(dateTo),
  });

  const response = await authenticatedFetch(
    `${config.vas.apiUrl}/api/SmartData/AlertData?${params}`,
    { method: 'GET' }
  );

  // AlertData can return 500 if no alerts - handle gracefully
  if (response.status === 500) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`VAS API AlertData error: ${response.status}`);
  }

  return response.json();
}

function formatDate(date) {
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}
