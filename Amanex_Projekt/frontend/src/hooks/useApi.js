import { useState, useEffect, useCallback } from 'react';

// ── useApi Hook
// Vereinfacht alle API-Calls im Dashboard
// Automatisches Laden, Fehlerbehandlung, Polling

export function useApi(fetchFn, deps = [], options = {}) {
  const { interval = null, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => {
    load();
    if (interval) {
      const id = setInterval(load, interval);
      return () => clearInterval(id);
    }
  }, [load, interval]);

  return { data, loading, error, reload: load };
}

// ── useBotStatus Hook
// Pollt den Bot-Status alle 10 Sekunden
export function useBotStatus() {
  const { bot } = require('./client');
  return useApi(() => bot.getStatus(), [], { interval: 10000 });
}

// ── useMetrics Hook
// Pollt die Dashboard-Metriken alle 30 Sekunden
export function useMetrics() {
  const { dashboard } = require('./client');
  return useApi(() => dashboard.getMetrics(), [], { interval: 30000 });
}
