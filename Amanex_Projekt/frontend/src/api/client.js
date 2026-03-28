// ── API CLIENT
// Alle Backend-Calls laufen durch diese Datei
// Token wird automatisch mitgeschickt
// Fehler werden einheitlich behandelt

const BASE_URL = process.env.REACT_APP_API_URL || 'https://amanex-production.up.railway.app';

// Token aus localStorage lesen
function getToken() {
  return localStorage.getItem('amanex_token');
}

// Token speichern
export function saveToken(token) {
  localStorage.setItem('amanex_token', token);
}

// Token loeschen (Logout)
export function clearToken() {
  localStorage.removeItem('amanex_token');
  localStorage.removeItem('amanex_user');
}

// Basis-Fetch mit Auth-Header
async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Token abgelaufen
  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    throw new Error('Sitzung abgelaufen');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Serverfehler' }));
    throw new Error(error.error || 'Unbekannter Fehler');
  }

  return res.json();
}

// ════════════════════════════════════
// AUTH
// ════════════════════════════════════

export const auth = {
  async login(email, password) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveToken(data.token);
    localStorage.setItem('amanex_user', JSON.stringify(data.user));
    return data;
  },

  logout() {
    clearToken();
    window.location.href = '/';
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('amanex_user'));
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!getToken();
  },
};

// ════════════════════════════════════
// BOT STEUERUNG
// ════════════════════════════════════

export const bot = {
  getStatus:    () => apiFetch('/api/bot/status'),
  start:        () => apiFetch('/api/bot/start', { method: 'POST' }),
  stop:         () => apiFetch('/api/bot/stop',  { method: 'POST' }),
  scanNow:      () => apiFetch('/api/bot/scan',  { method: 'POST' }),
};

// ════════════════════════════════════
// DASHBOARD DATEN
// ════════════════════════════════════

export const dashboard = {
  getMetrics: () => apiFetch('/api/dashboard/metrics'),
};

export const trades = {
  getAll:    (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/trades${query ? '?' + query : ''}`);
  },
  getOpen:   () => apiFetch('/api/trades?status=open'),
  getClosed: () => apiFetch('/api/trades?status=closed'),
};

export const scanner = {
  getResults: () => apiFetch('/api/scanner/results'),
};

export const knowledge = {
  getAll: () => apiFetch('/api/knowledge'),
};

export const settings = {
  get:  ()       => apiFetch('/api/settings'),
  save: (data)   => apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

export const team = {
  getAll: () => apiFetch('/api/team'),
};

export const health = {
  check: () => apiFetch('/health'),
};
