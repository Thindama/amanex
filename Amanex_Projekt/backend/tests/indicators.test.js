// Unit tests fuer localIndicators.js
// Ausfuehren: node --test tests/indicators.test.js
// (Built-in Node-Test-Runner, keine extra Dependencies)

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ind = require('../src/indicators/localIndicators');

// ── Helpers ───────────────────────────────────────────────────────────────

function makeCandles(closes) {
  return closes.map((c, i) => ({
    openTime: i * 1000,
    open: c,
    high: c * 1.01,
    low: c * 0.99,
    close: c,
    volume: 1000,
    closeTime: i * 1000 + 999,
  }));
}

const APPROX = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ── SMA ────────────────────────────────────────────────────────────────────

test('SMA: monotonic input', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = ind.sma(values, 3);
  assert.equal(result[0], null);
  assert.equal(result[1], null);
  assert.equal(result[2], 2);   // (1+2+3)/3
  assert.equal(result[3], 3);   // (2+3+4)/3
  assert.equal(result[9], 9);   // (8+9+10)/3
});

test('SMA: period longer than input', () => {
  const result = ind.sma([1, 2, 3], 5);
  assert.deepEqual(result, [null, null, null]);
});

test('SMA: constant input returns constant', () => {
  const result = ind.sma([5, 5, 5, 5, 5], 3);
  assert.equal(result[2], 5);
  assert.equal(result[3], 5);
  assert.equal(result[4], 5);
});

// ── EMA ────────────────────────────────────────────────────────────────────

test('EMA: constant input converges to constant', () => {
  const result = ind.ema([10, 10, 10, 10, 10, 10, 10], 3);
  assert.ok(APPROX(result[6], 10, 1e-9));
});

test('EMA: rising input — EMA lags but grows', () => {
  const result = ind.ema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
  // alpha = 2/(3+1) = 0.5
  // seed i=0: 1
  // i=1: 0.5*2 + 0.5*1 = 1.5
  // i=2: 0.5*3 + 0.5*1.5 = 2.25  (reif ab period-1 = 2)
  assert.ok(APPROX(result[2], 2.25));
  // i=3: 0.5*4 + 0.5*2.25 = 3.125
  assert.ok(APPROX(result[3], 3.125));
});

// ── RSI ────────────────────────────────────────────────────────────────────

test('RSI: monotonic up → 100', () => {
  const values = Array.from({ length: 20 }, (_, i) => 100 + i);
  const result = ind.rsi(values, 14);
  assert.ok(result[14] > 99); // Alle Gains, keine Losses
});

test('RSI: monotonic down → 0', () => {
  const values = Array.from({ length: 20 }, (_, i) => 200 - i);
  const result = ind.rsi(values, 14);
  assert.ok(result[14] < 1); // Alle Losses, keine Gains
});

test('RSI: requires period+1 values', () => {
  const result = ind.rsi([1, 2, 3], 14);
  assert.ok(result.every(v => v === null));
});

test('RSI: known fixture — classic Wilder example', () => {
  // Standard 14er RSI Fixture (aus Wilder's Buch / pandas-ta Doku)
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
    45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
    46.03, 46.41, 46.22, 45.64,
  ];
  const result = ind.rsi(closes, 14);
  // Erwarteter Wert am Index 14 (erster RSI) ist ~70.53
  assert.ok(result[14] > 65 && result[14] < 75, `RSI[14]=${result[14]}, expected ~70`);
});

// ── MACD ───────────────────────────────────────────────────────────────────

test('MACD: returns three parallel series', () => {
  const values = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
  const m = ind.macd(values, 12, 26, 9);
  assert.equal(m.macd.length, 50);
  assert.equal(m.signal.length, 50);
  assert.equal(m.histogram.length, 50);
});

test('MACD: histogram = macd − signal where both defined', () => {
  const values = Array.from({ length: 50 }, (_, i) => 100 + i);
  const m = ind.macd(values, 12, 26, 9);
  const lastIdx = 49;
  if (m.macd[lastIdx] !== null && m.signal[lastIdx] !== null) {
    const expected = m.macd[lastIdx] - m.signal[lastIdx];
    assert.ok(APPROX(m.histogram[lastIdx], expected, 1e-9));
  }
});

// ── ATR ────────────────────────────────────────────────────────────────────

test('ATR: produces positive values', () => {
  const candles = makeCandles([100, 102, 98, 105, 103, 107, 109, 106, 110, 115,
                                112, 118, 120, 119, 125, 123, 128, 130, 127]);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const result = ind.atr(highs, lows, closes, 14);
  assert.ok(result[14] > 0);
});

test('ATR: flat market → approx 2% (from high/low spread in makeCandles)', () => {
  const candles = makeCandles(Array(20).fill(100));
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const result = ind.atr(highs, lows, closes, 14);
  // high = 101, low = 99, close = 100 → TR = 2 konstant
  assert.ok(APPROX(result[14], 2, 1e-6));
});

// ── Bollinger Bands ────────────────────────────────────────────────────────

test('BBands: upper > middle > lower', () => {
  const values = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
  const bb = ind.bbands(values, 20, 2);
  const i = 25;
  assert.ok(bb.upper[i] > bb.middle[i]);
  assert.ok(bb.middle[i] > bb.lower[i]);
});

test('BBands: constant input → zero band width', () => {
  const bb = ind.bbands(Array(25).fill(50), 20, 2);
  assert.ok(APPROX(bb.upper[24], 50));
  assert.ok(APPROX(bb.middle[24], 50));
  assert.ok(APPROX(bb.lower[24], 50));
});

// ── ADX ────────────────────────────────────────────────────────────────────

test('ADX: returns values between 0 and 100 for trending data', () => {
  const n = 40;
  const highs = Array.from({ length: n }, (_, i) => 100 + i + 1);
  const lows = Array.from({ length: n }, (_, i) => 100 + i - 1);
  const closes = Array.from({ length: n }, (_, i) => 100 + i);
  const result = ind.adx(highs, lows, closes, 14);
  const lastAdx = ind.last(result);
  assert.ok(lastAdx >= 0 && lastAdx <= 100);
});

// ── OBV ────────────────────────────────────────────────────────────────────

test('OBV: rising prices → rising OBV', () => {
  const closes = [10, 11, 12, 13, 14];
  const volumes = [100, 100, 100, 100, 100];
  const result = ind.obv(closes, volumes);
  assert.equal(result[0], 0);
  assert.equal(result[1], 100);
  assert.equal(result[2], 200);
  assert.equal(result[3], 300);
  assert.equal(result[4], 400);
});

test('OBV: falling prices → falling OBV', () => {
  const closes = [10, 9, 8, 7, 6];
  const volumes = [100, 100, 100, 100, 100];
  const result = ind.obv(closes, volumes);
  assert.equal(result[4], -400);
});

// ── VWAP ───────────────────────────────────────────────────────────────────

test('VWAP: single candle → typical price', () => {
  const result = ind.vwap([101], [99], [100], [1000]);
  assert.ok(APPROX(result[0], 100)); // tp = (101+99+100)/3 = 100
});

// ── computeAll ─────────────────────────────────────────────────────────────

test('computeAll: returns full indicator suite', () => {
  const candles = makeCandles(Array.from({ length: 50 }, (_, i) => 100 + i));
  const all = ind.computeAll(candles);
  assert.ok(Array.isArray(all.sma20));
  assert.ok(Array.isArray(all.ema12));
  assert.ok(Array.isArray(all.rsi14));
  assert.ok(all.macd && Array.isArray(all.macd.macd));
  assert.ok(all.bb20 && Array.isArray(all.bb20.upper));
  assert.equal(all.sma20.length, 50);
});

test('computeAll: empty candles → empty arrays', () => {
  const all = ind.computeAll([]);
  assert.deepEqual(all.sma20, []);
  assert.deepEqual(all.rsi14, []);
  assert.deepEqual(all.macd.macd, []);
});

// ── last / lastN ───────────────────────────────────────────────────────────

test('last: skips trailing nulls', () => {
  assert.equal(ind.last([1, 2, 3, null, null]), 3);
  assert.equal(ind.last([null, null]), null);
  assert.equal(ind.last([]), null);
});

test('lastN: returns last n non-null values', () => {
  assert.deepEqual(ind.lastN([1, null, 2, 3, null, 4], 3), [2, 3, 4]);
  assert.deepEqual(ind.lastN([1, 2, 3], 5), [1, 2, 3]);
});
