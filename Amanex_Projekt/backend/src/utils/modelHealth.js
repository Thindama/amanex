// In-memory per-model health tracker. Wird von prediction.js bei jedem
// Modell-Call upgedated und via /api/bot/model-health exponiert.
// Absicht: im Dashboard sofort sehen, welches Modell gerade tot ist
// (Credits leer, HTTP 429, key rotiert), statt Railway-Logs zu durchsuchen.

const MODELS = ['grok', 'claude', 'gpt4o', 'gemini', 'deepseek'];

const state = {};
for (const m of MODELS) {
  state[m] = {
    calls: 0,
    errors: 0,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
  };
}

module.exports = {
  recordSuccess(model) {
    if (!state[model]) return;
    state[model].calls += 1;
    state[model].lastSuccessAt = new Date().toISOString();
  },
  recordError(model, msg) {
    if (!state[model]) return;
    state[model].calls += 1;
    state[model].errors += 1;
    state[model].lastErrorAt = new Date().toISOString();
    state[model].lastError = String(msg).slice(0, 200);
  },
  snapshot() {
    const out = {};
    for (const m of MODELS) {
      const s = state[m];
      const errorRate = s.calls > 0 ? s.errors / s.calls : 0;
      let status = 'unknown';
      if (s.calls === 0) status = 'idle';
      else if (errorRate >= 0.9) status = 'down';
      else if (errorRate >= 0.3) status = 'degraded';
      else status = 'healthy';
      out[m] = { ...s, errorRate: Number(errorRate.toFixed(3)), status };
    }
    return out;
  },
};
