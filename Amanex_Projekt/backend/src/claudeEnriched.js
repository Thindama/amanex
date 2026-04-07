// ── CLAUDE ENRICHED SIGNAL CHANNEL
// Liefert ein Claude-Signal mit vollem Marktkontext (Candles + alle Indikatoren
// + Position + Funding + Open Interest) statt nur Preisdaten.
//
// Das Output-Format {signal, confidence, reasoning, tpPrice, slPrice} passt
// nahtlos in den bestehenden Amanex-Multi-AI-Konsens-Aggregator
// (Grok 30% / Claude 20% / GPT-4o 20% / Gemini 15% / DeepSeek 15%).
//
// Integration: Das Modul ist ein Drop-in-Ersatz fuer den bestehenden Claude-Call
// in services/aiConsensus.js (Railway). Beispiel-Wiring:
//
//   // Alt:
//   const claudeSignal = await callClaude(asset, priceData);
//
//   // Neu (Option 1 — fuer alle Exchanges):
//   const claudeSignal = await claudeEnriched.getSignal({
//     exchange: market.platform, asset: market.id,
//     candles: market._candles, indicators: market._indicators,
//     position: openPositionFor(asset),
//     funding: market.funding, openInterest: market.openInterest,
//   });
//
//   // Neu (Option 2 — nur Hyperliquid, sicherer fuer Phase 1):
//   const claudeSignal = market.platform === 'hyperliquid'
//     ? await claudeEnriched.getSignal({ ... })
//     : await callClaude(asset, priceData);

'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const indicators = require('../indicators/localIndicators');

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const FALLBACK_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;

// Lazy-require damit das Modul geladen werden kann auch wenn @anthropic-ai/sdk
// (noch) nicht installiert ist.
let _anthropic = null;
function getClient() {
  if (_anthropic) return _anthropic;
  try {
    // eslint-disable-next-line global-require
    const Anthropic = require('@anthropic-ai/sdk');
    _anthropic = new Anthropic.Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
    });
    return _anthropic;
  } catch (err) {
    logger.error('Anthropic SDK not available', { message: err.message });
    return null;
  }
}

// ── System Prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein rigoroser quantitativer Trader und interdisziplinaerer Mathematiker-Ingenieur mit Fokus auf Perpetual-Futures und Spot-Maerkten.

Analysiere den gelieferten Marktkontext (Candles + technische Indikatoren + optional Position + Funding + Open Interest) und gib EIN strikt valides JSON-Objekt zurueck mit den Feldern:
- signal: "BUY" | "SELL" | "HOLD"
- confidence: Zahl zwischen 0.0 und 1.0 (wie sicher bist du)
- reasoning: kurze Begruendung (max 200 Zeichen, Englisch oder Deutsch)
- tpPrice: Take-Profit-Preis oder null
- slPrice: Stop-Loss-Preis oder null

Regeln:
1. Respektiere bestehende Exit-Plaene bei offenen Positionen — wechsle Richtung nur bei stark gegenteiliger Evidenz.
2. Nutze Hysterese: Haltebias vor Wechselbias.
3. Funding-Rate ist ein Tilt, kein Richtungs-Trigger.
4. Keine Revenge-Trades allein auf Overbought/Oversold-Signalen.
5. Stop-Loss ist bei neuen Positionen Pflicht, es sei denn du setzt ihn explizit auf null mit Begruendung.
6. ANTWORTE NUR MIT DEM JSON. Keine Markdown-Fences, kein Prosa davor oder danach.`;

// ── Helpers ───────────────────────────────────────────────────────────────

function lastValues(ind, n = 3) {
  const out = {};
  for (const [key, val] of Object.entries(ind || {})) {
    if (Array.isArray(val)) {
      out[key] = indicators.lastN(val, n);
    } else if (val && typeof val === 'object') {
      out[key] = {};
      for (const [subKey, subVal] of Object.entries(val)) {
        if (Array.isArray(subVal)) out[key][subKey] = indicators.lastN(subVal, n);
      }
    }
  }
  return out;
}

function compactCandles(candles, n = 20) {
  if (!candles || !candles.length) return [];
  return candles.slice(-n).map(c => ({
    t: c.openTime,
    o: +c.open.toFixed(6),
    h: +c.high.toFixed(6),
    l: +c.low.toFixed(6),
    c: +c.close.toFixed(6),
    v: +c.volume.toFixed(2),
  }));
}

function buildMarketContext(input) {
  const {
    exchange, asset, candles, candles4h, indicators: ind, indicators4h,
    position, funding, openInterest, currentPrice, hardLimits,
  } = input;

  const indCompact = ind || (candles ? indicators.computeAll(candles) : null);
  const ind4hCompact = indicators4h || (candles4h ? indicators.computeAll(candles4h) : null);

  const ctx = {
    timestamp: new Date().toISOString(),
    exchange,
    asset,
    currentPrice: currentPrice ?? (candles && candles.length ? candles[candles.length - 1].close : null),
    intraday: {
      candles: compactCandles(candles, 20),
      indicators: lastValues(indCompact, 3),
    },
    higherTimeframe: candles4h ? {
      candles: compactCandles(candles4h, 15),
      indicators: lastValues(ind4hCompact, 3),
    } : null,
    funding: funding ?? null,
    openInterest: openInterest ?? null,
    position: position ? {
      side: position.side,
      size: position.size,
      entryPrice: position.entryPrice,
      unrealizedPnlPct: position.unrealizedPnlPct,
      leverage: position.leverage,
    } : null,
    hardLimits: hardLimits || { maxLeverage: 10, maxPositionPct: 10 },
  };

  return ctx;
}

function stripFences(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return s.trim();
}

function parseClaudeResponse(raw) {
  const cleaned = stripFences(raw);
  try {
    const obj = JSON.parse(cleaned);
    const signal = String(obj.signal || 'HOLD').toUpperCase();
    if (!['BUY', 'SELL', 'HOLD'].includes(signal)) {
      throw new Error('invalid signal value: ' + signal);
    }
    const confidence = Math.max(0, Math.min(1, Number(obj.confidence) || 0));
    return {
      signal,
      confidence,
      reasoning: String(obj.reasoning || '').slice(0, 240),
      tpPrice: obj.tpPrice != null ? Number(obj.tpPrice) : null,
      slPrice: obj.slPrice != null ? Number(obj.slPrice) : null,
    };
  } catch (err) {
    return null;
  }
}

async function sanitize(raw) {
  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    const resp = await anthropic.messages.create({
      model: FALLBACK_MODEL,
      max_tokens: 512,
      system: 'Du bekommst eine potenziell malformierte Antwort. Extrahiere die Felder signal (BUY|SELL|HOLD), confidence (0-1), reasoning, tpPrice, slPrice und gib NUR das saubere JSON zurueck.',
      messages: [{ role: 'user', content: raw }],
    });
    const text = resp.content?.[0]?.text || '';
    return parseClaudeResponse(text);
  } catch (err) {
    logger.warn('Claude sanitizer failed', { message: err.message });
    return null;
  }
}

// ── Haupt-API ─────────────────────────────────────────────────────────────

async function getSignal(input) {
  const anthropic = getClient();
  if (!anthropic) {
    return { signal: 'HOLD', confidence: 0, reasoning: 'Anthropic SDK unavailable', tpPrice: null, slPrice: null };
  }

  const ctx = buildMarketContext(input);
  const model = config.CLAUDE_MODEL_HYPERLIQUID || DEFAULT_MODEL;

  let raw = '';
  try {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: 'Marktkontext:\n' + JSON.stringify(ctx, null, 2),
      }],
    });
    raw = resp.content?.[0]?.text || '';
  } catch (err) {
    logger.error('Claude getSignal request failed', {
      exchange: input.exchange, asset: input.asset, message: err.message,
    });
    return { signal: 'HOLD', confidence: 0, reasoning: 'Claude request failed: ' + err.message, tpPrice: null, slPrice: null };
  }

  let parsed = parseClaudeResponse(raw);
  if (!parsed) {
    logger.warn('Claude response malformed, invoking sanitizer', {
      exchange: input.exchange, asset: input.asset, preview: raw.slice(0, 100),
    });
    parsed = await sanitize(raw);
  }

  if (!parsed) {
    return { signal: 'HOLD', confidence: 0, reasoning: 'Parse failed', tpPrice: null, slPrice: null };
  }

  return parsed;
}

module.exports = {
  getSignal,
  // Intern exportiert fuer Tests
  buildMarketContext,
  parseClaudeResponse,
  stripFences,
  SYSTEM_PROMPT,
};
