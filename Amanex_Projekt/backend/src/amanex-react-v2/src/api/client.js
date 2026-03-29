const BASE_URL = process.env.REACT_APP_API_URL || 'https://amanex-production.up.railway.app';

function getToken() { return localStorage.getItem('amanex_token'); }
export function saveToken(t) { localStorage.setItem('amanex_token', t); }
export function clearToken() { localStorage.removeItem('amanex_token'); localStorage.removeItem('amanex_user'); }

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
  if (res.status === 401) { clearToken(); window.location.href = '/'; throw new Error('Sitzung abgelaufen'); }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Serverfehler' })); throw new Error(err.error || 'Fehler'); }
  return res.json();
}

export const auth = {
  async login(email, password) {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    saveToken(data.token);
    localStorage.setItem('amanex_user', JSON.stringify(data.user));
    return data;
  },
  logout() { clearToken(); window.location.href = '/'; },
  getUser() { try { return JSON.parse(localStorage.getItem('amanex_user')); } catch { return null; } },
  isLoggedIn() { return !!getToken(); },
};

export const bot = {
  getStatus: () => apiFetch('/api/bot/status'),
  start:     () => apiFetch('/api/bot/start', { method: 'POST' }),
  stop:      () => apiFetch('/api/bot/stop',  { method: 'POST' }),
  scanNow:   () => apiFetch('/api/bot/scan',  { method: 'POST' }),
};

export const dashboard = { getMetrics: () => apiFetch('/api/dashboard/metrics') };
export const trades = {
  getAll: (p={}) => apiFetch(`/api/trades${Object.keys(p).length?'?'+new URLSearchParams(p):''}`),
  getOpen: () => apiFetch('/api/trades?status=open'),
};
export const scanner = { getResults: () => apiFetch('/api/scanner/results') };
export const settings = {
  get:  ()   => apiFetch('/api/settings'),
  save: (d)  => apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(d) }),
};
export const team  = { getAll: () => apiFetch('/api/team') };
export const health = { check: () => apiFetch('/health') };
