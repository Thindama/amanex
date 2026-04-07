// ── LOCAL TECHNICAL INDICATORS
// Port von sanketagarwal/hyperliquid-trading-agent src/indicators/local_indicators.py
// Hand-rolled, keine externe Library. EMA/RSI/MACD/ATR/BB/ADX/OBV/VWAP.
//
// Input-Format: Amanex-Candles wie in binance.js:
//   [{ openTime, open, high, low, close, volume, closeTime }, ...]
//
// Alle Funktionen geben Arrays gleicher Laenge wie der Input zurueck.
// Leading Werte wo das Fenster noch nicht voll ist = null.

'use strict';

// ── HELPER ────────────────────────────────────────────────────────────────

function toNumber(x) {
  const n = typeof x === 'number' ? x : parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

function pickSeries(candles, key) {
  return candles.map(c => toNumber(c[key]));
}

function last(series) {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null && series[i] !== undefined && Number.isFinite(series[i])) {
      return series[i];
    }
  }
  return null;
}

function lastN(series, n) {
  const out = [];
  for (let i = series.length - 1; i >= 0 && out.length < n; i--) {
    if (series[i] !== null && series[i] !== undefined && Number.isFinite(series[i])) {
      out.unshift(series[i]);
    }
  }
  return out;
}

// ── SMA ───────────────────────────────────────────────────────────────────

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  if (!values.length || period <= 0) return out;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) { out[i] = null; continue; }
    sum += v;
    count++;
    if (i >= period) {
      const old = values[i - period];
      if (old !== null) { sum -= old; count--; }
    }
    if (count >= period) out[i] = sum / period;
  }
  return out;
}

// ── EMA ───────────────────────────────────────────────────────────────────
// Standard EMA mit Alpha = 2/(period+1). Gleicher Seed wie pandas.ewm(adjust=False):
// erster Wert ist der Rohwert, danach alpha*new + (1-alpha)*prev.

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (!values.length || period <= 0) return out;
  const alpha = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) { out[i] = prev; continue; }
    if (prev === null) {
      prev = v;
    } else {
      prev = alpha * v + (1 - alpha) * prev;
    }
    // Erst ab period-1 gelten die EMA-Werte als "reif"
    if (i >= period - 1) out[i] = prev;
  }
  return out;
}

// ── RSI (Wilder's Smoothing) ──────────────────────────────────────────────

function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;

  // Initialer Mittelwert aus ersten `period` Differenzen
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += -diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  out[period] = firstRsi;

  // Wilder's smoothing danach
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// ── MACD ──────────────────────────────────────────────────────────────────

function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => {
    if (emaFast[i] === null || emaSlow[i] === null) return null;
    return emaFast[i] - emaSlow[i];
  });
  // Signal = EMA(macdLine, signalPeriod) — aber nur auf non-null Werten
  const macdForEma = macdLine.map(v => (v === null ? null : v));
  const signalLine = ema(macdForEma, signalPeriod);
  const histogram = macdLine.map((v, i) => {
    if (v === null || signalLine[i] === null) return null;
    return v - signalLine[i];
  });
  return { macd: macdLine, signal: signalLine, histogram };
}

// ── STOCH RSI ─────────────────────────────────────────────────────────────

function stochRsi(values, period = 14, kPeriod = 3, dPeriod = 3) {
  const rsiSeries = rsi(values, period);
  const out = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (rsiSeries[i] === null) continue;
    let min = Infinity;
    let max = -Infinity;
    let have = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (j < 0 || rsiSeries[j] === null) continue;
      if (rsiSeries[j] < min) min = rsiSeries[j];
      if (rsiSeries[j] > max) max = rsiSeries[j];
      have++;
    }
    if (have < period) continue;
    out[i] = max === min ? 0 : ((rsiSeries[i] - min) / (max - min)) * 100;
  }
  const k = sma(out, kPeriod);
  const d = sma(k, dPeriod);
  return { K: k, D: d };
}

// ── ATR (Wilder's) ────────────────────────────────────────────────────────

function atr(highs, lows, closes, period = 14) {
  const n = closes.length;
  const out = new Array(n).fill(null);
  if (n < period + 1) return out;

  const tr = new Array(n).fill(null);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(hl, hc, lc);
  }

  // Initialer ATR = Mittelwert der ersten `period` TRs
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;

  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

// ── BOLLINGER BANDS ───────────────────────────────────────────────────────

function bbands(values, period = 20, stdDev = 2) {
  const middle = sma(values, period);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    if (middle[i] === null) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - middle[i];
      sumSq += diff * diff;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * std;
    lower[i] = middle[i] - stdDev * std;
  }
  return { upper, middle, lower };
}

// ── ADX (Wilder's) ────────────────────────────────────────────────────────

function adx(highs, lows, closes, period = 14) {
  const n = closes.length;
  const out = new Array(n).fill(null);
  if (n < 2 * period) return out;

  const trArr = new Array(n).fill(0);
  const plusDm = new Array(n).fill(0);
  const minusDm = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDm[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trArr[i] = Math.max(hl, hc, lc);
  }

  // Wilder-Smoothing der ersten `period` Werte
  let trSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 1; i <= period; i++) {
    trSum += trArr[i];
    plusSum += plusDm[i];
    minusSum += minusDm[i];
  }

  const plusDi = new Array(n).fill(null);
  const minusDi = new Array(n).fill(null);
  const dx = new Array(n).fill(null);

  if (trSum > 0) {
    plusDi[period] = (plusSum / trSum) * 100;
    minusDi[period] = (minusSum / trSum) * 100;
    const sum = plusDi[period] + minusDi[period];
    dx[period] = sum === 0 ? 0 : (Math.abs(plusDi[period] - minusDi[period]) / sum) * 100;
  }

  let smoothTr = trSum;
  let smoothPlus = plusSum;
  let smoothMinus = minusSum;

  for (let i = period + 1; i < n; i++) {
    smoothTr = smoothTr - smoothTr / period + trArr[i];
    smoothPlus = smoothPlus - smoothPlus / period + plusDm[i];
    smoothMinus = smoothMinus - smoothMinus / period + minusDm[i];
    if (smoothTr > 0) {
      plusDi[i] = (smoothPlus / smoothTr) * 100;
      minusDi[i] = (smoothMinus / smoothTr) * 100;
      const sum = plusDi[i] + minusDi[i];
      dx[i] = sum === 0 ? 0 : (Math.abs(plusDi[i] - minusDi[i]) / sum) * 100;
    }
  }

  // ADX = SMA von DX ueber period, startend bei 2*period
  let dxSum = 0;
  for (let i = period; i < 2 * period; i++) {
    if (dx[i] !== null) dxSum += dx[i];
  }
  out[2 * period - 1] = dxSum / period;

  for (let i = 2 * period; i < n; i++) {
    if (dx[i] === null || out[i - 1] === null) continue;
    out[i] = (out[i - 1] * (period - 1) + dx[i]) / period;
  }
  return out;
}

// ── OBV ───────────────────────────────────────────────────────────────────

function obv(closes, volumes) {
  const out = new Array(closes.length).fill(null);
  if (!closes.length) return out;
  out[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] - volumes[i];
    else out[i] = out[i - 1];
  }
  return out;
}

// ── VWAP ──────────────────────────────────────────────────────────────────
// Kumulativ ueber den gesamten Input — fuer Session-VWAP vorher auf die
// gewuenschte Session zuschneiden.

function vwap(highs, lows, closes, volumes) {
  const out = new Array(closes.length).fill(null);
  let cumPv = 0;
  let cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPv += tp * volumes[i];
    cumVol += volumes[i];
    out[i] = cumVol === 0 ? null : cumPv / cumVol;
  }
  return out;
}

// ── COMPUTE ALL ───────────────────────────────────────────────────────────
// Generiert den vollen Indikatoren-Satz aus einem Candle-Array im Amanex-Format.

function computeAll(candles) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      sma20: [], ema12: [], ema26: [], ema50: [],
      rsi14: [], macd: { macd: [], signal: [], histogram: [] },
      stochRsi: { K: [], D: [] },
      atr14: [], bb20: { upper: [], middle: [], lower: [] },
      adx14: [], obv: [], vwap: [],
    };
  }
  const closes = pickSeries(candles, 'close');
  const highs = pickSeries(candles, 'high');
  const lows = pickSeries(candles, 'low');
  const volumes = pickSeries(candles, 'volume');

  return {
    sma20: sma(closes, 20),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    ema50: ema(closes, 50),
    rsi14: rsi(closes, 14),
    macd: macd(closes, 12, 26, 9),
    stochRsi: stochRsi(closes, 14, 3, 3),
    atr14: atr(highs, lows, closes, 14),
    bb20: bbands(closes, 20, 2),
    adx14: adx(highs, lows, closes, 14),
    obv: obv(closes, volumes),
    vwap: vwap(highs, lows, closes, volumes),
  };
}

module.exports = {
  sma, ema, rsi, macd, stochRsi, atr, bbands, adx, obv, vwap,
  computeAll, last, lastN,
  // Helper (exportiert fuer Tests)
  _pickSeries: pickSeries,
};
