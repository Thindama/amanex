// Unit tests fuer riskManager.js
// Ausfuehren: node --test tests/riskManager.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Stub fuer den Logger (den das echte Modul aus ../utils/logger laedt)
// Wir fangen das per require-cache-Manipulation ab bevor das Modul geladen wird.
const loggerStub = { info() {}, warn() {}, error() {}, debug() {} };
require.cache[require.resolve.paths('../src/utils/logger')[0] + '/logger.js'] = {
  exports: loggerStub,
};
// Fallback: direkt den Modulpfad stubben
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '../utils/logger' || request.endsWith('utils/logger')) {
    return require.resolve('./_loggerStub.js');
  }
  return originalResolve.call(this, request, ...rest);
};

// Schreibe den Logger-Stub in eine temp-Datei damit der require funktioniert
const stubPath = path.join(__dirname, '_loggerStub.js');
if (!fs.existsSync(stubPath)) {
  fs.writeFileSync(stubPath, 'module.exports = { info(){}, warn(){}, error(){}, debug(){} };\n');
}

const { RiskManager, DEFAULTS } = require('../src/risk/riskManager');

// ── Helpers ───────────────────────────────────────────────────────────────

function makeManager(overrides = {}) {
  const tmpState = path.join(os.tmpdir(), `risk_state_${Date.now()}_${Math.random()}.json`);
  return new RiskManager(overrides, { statePath: tmpState });
}

function baseIntent(over = {}) {
  return {
    exchange: 'hyperliquid',
    asset: 'BTC',
    side: 'buy',
    allocationUsd: 500,
    leverage: 3,
    price: 100000,
    slPrice: null,
    tpPrice: null,
    ...over,
  };
}

function baseState(over = {}) {
  return {
    balance: 10000,
    equity: 10000,
    initialBalance: 10000,
    openPositions: [],
    currentPrice: 100000,
    ...over,
  };
}

// ── Min Order Size ─────────────────────────────────────────────────────────

test('rejects allocation below MIN_ORDER_SIZE_USD', async () => {
  const rm = makeManager();
  const res = await rm.check(baseIntent({ allocationUsd: 5 }), baseState());
  assert.equal(res.approved, false);
  assert.match(res.reason, /MIN_ORDER_SIZE/);
});

test('accepts allocation at MIN_ORDER_SIZE_USD', async () => {
  const rm = makeManager();
  const res = await rm.check(baseIntent({ allocationUsd: 11 }), baseState());
  assert.equal(res.approved, true);
});

// ── Leverage Cap ───────────────────────────────────────────────────────────

test('caps leverage at MAX_LEVERAGE', async () => {
  const rm = makeManager();
  const res = await rm.check(baseIntent({ leverage: 25 }), baseState());
  assert.equal(res.approved, true);
  assert.equal(res.adjustedIntent.leverage, DEFAULTS.MAX_LEVERAGE);
});

test('leaves leverage unchanged if below cap', async () => {
  const rm = makeManager();
  const res = await rm.check(baseIntent({ leverage: 5 }), baseState());
  assert.equal(res.adjustedIntent.leverage, 5);
});

// ── Max Position ───────────────────────────────────────────────────────────

test('caps allocation at MAX_POSITION_PCT of equity', async () => {
  const rm = makeManager();
  // 10% von 10000 = 1000. Intent 2000 → gecapt auf 1000.
  const res = await rm.check(baseIntent({ allocationUsd: 2000 }), baseState({ balance: 10000, equity: 10000 }));
  assert.equal(res.approved, true);
  assert.equal(res.adjustedIntent.allocationUsd, 1000);
});

test('no cap if allocation below MAX_POSITION_PCT', async () => {
  const rm = makeManager();
  const res = await rm.check(baseIntent({ allocationUsd: 500 }), baseState({ balance: 10000, equity: 10000 }));
  assert.equal(res.adjustedIntent.allocationUsd, 500);
});

// ── Total Exposure ─────────────────────────────────────────────────────────

test('rejects when total exposure already at cap', async () => {
  const rm = makeManager();
  // MAX_TOTAL_EXPOSURE_PCT = 50% von 10000 = 5000. Offen bereits 5000 → remaining = 0.
  const res = await rm.check(
    baseIntent({ allocationUsd: 100 }),
    baseState({
      balance: 10000, equity: 10000,
      openPositions: [{ asset: 'ETH', notionalUsd: 5000 }],
    }),
  );
  assert.equal(res.approved, false);
  assert.match(res.reason, /Total exposure/);
});

test('caps allocation by remaining exposure room', async () => {
  const rm = makeManager();
  // 50% von 10000 = 5000. Offen 4500 → remaining = 500. Intent 800 → gecapt auf 500.
  const res = await rm.check(
    baseIntent({ allocationUsd: 800 }),
    baseState({
      balance: 10000, equity: 10000,
      openPositions: [{ asset: 'ETH', notionalUsd: 4500 }],
    }),
  );
  assert.equal(res.approved, true);
  assert.equal(res.adjustedIntent.allocationUsd, 500);
});

// ── Balance Reserve ────────────────────────────────────────────────────────

test('rejects if reserve would be violated', async () => {
  const rm = makeManager();
  // MIN_BALANCE_RESERVE_PCT = 20% von 10000 = 2000.
  // free after trade = balance - allocation = 10000 - 9000 = 1000 < 2000 → reject.
  // Aber: allocation 9000 wird zuerst auf 1000 gecapt (MAX_POSITION_PCT).
  // Mit allocation 1000 ist free = 9000 >> 2000 → ok.
  // Um Reserve zu testen muessen wir MAX_POSITION_PCT hochsetzen.
  const rm2 = makeManager({ MAX_POSITION_PCT: 100, MAX_TOTAL_EXPOSURE_PCT: 100 });
  const res = await rm2.check(
    baseIntent({ allocationUsd: 9000 }),
    baseState({ balance: 10000, equity: 10000, initialBalance: 10000 }),
  );
  assert.equal(res.approved, false);
  assert.match(res.reason, /reserve/i);
});

// ── Daily Circuit Breaker ──────────────────────────────────────────────────

test('triggers circuit breaker at daily loss threshold', async () => {
  const rm = makeManager({ DAILY_LOSS_CIRCUIT_BREAKER_PCT: 10 });
  // Erster Call um startEquity = 10000 zu setzen
  await rm.check(baseIntent(), baseState({ balance: 10000, equity: 10000 }));
  // Zweiter Call mit Equity = 8900 → -11% vom Tagesstart
  const res = await rm.check(baseIntent(), baseState({ balance: 8900, equity: 8900 }));
  assert.equal(res.approved, false);
  assert.match(res.reason, /circuit breaker/i);
});

test('circuit breaker stays tripped on subsequent calls same day', async () => {
  const rm = makeManager({ DAILY_LOSS_CIRCUIT_BREAKER_PCT: 10 });
  await rm.check(baseIntent(), baseState({ balance: 10000, equity: 10000 }));
  await rm.check(baseIntent(), baseState({ balance: 8000, equity: 8000 })); // trips
  // Recovered equity, aber Breaker bleibt getrippt
  const res = await rm.check(baseIntent(), baseState({ balance: 9500, equity: 9500 }));
  assert.equal(res.approved, false);
  assert.match(res.reason, /circuit breaker/i);
});

// ── Max Concurrent ─────────────────────────────────────────────────────────

test('rejects when at max concurrent positions', async () => {
  const rm = makeManager({ MAX_CONCURRENT_POSITIONS: 3 });
  const positions = [
    { asset: 'BTC', notionalUsd: 100 },
    { asset: 'ETH', notionalUsd: 100 },
    { asset: 'SOL', notionalUsd: 100 },
  ];
  const res = await rm.check(baseIntent(), baseState({ openPositions: positions }));
  assert.equal(res.approved, false);
  assert.match(res.reason, /concurrent/);
});

// ── Mandatory SL ───────────────────────────────────────────────────────────

test('auto-sets mandatory stop-loss at 5% below entry for buy', async () => {
  const rm = makeManager();
  const res = await rm.check(
    baseIntent({ side: 'buy', slPrice: null, price: 100 }),
    baseState({ currentPrice: 100 }),
  );
  assert.equal(res.approved, true);
  assert.ok(res.adjustedIntent.slPrice);
  assert.ok(Math.abs(res.adjustedIntent.slPrice - 95) < 0.01);
});

test('auto-sets mandatory stop-loss above entry for sell', async () => {
  const rm = makeManager();
  const res = await rm.check(
    baseIntent({ side: 'sell', slPrice: null, price: 100 }),
    baseState({ currentPrice: 100 }),
  );
  assert.equal(res.approved, true);
  assert.ok(Math.abs(res.adjustedIntent.slPrice - 105) < 0.01);
});

test('keeps existing stop-loss if provided', async () => {
  const rm = makeManager();
  const res = await rm.check(
    baseIntent({ slPrice: 90, price: 100 }),
    baseState({ currentPrice: 100 }),
  );
  assert.equal(res.adjustedIntent.slPrice, 90);
});

// ── Slippage Guard ─────────────────────────────────────────────────────────

test('rejects excessive slippage', async () => {
  const rm = makeManager();
  const res = await rm.check(
    baseIntent({ price: 100 }),
    baseState({ currentPrice: 110 }), // 10% slippage
  );
  assert.equal(res.approved, false);
  assert.match(res.reason, /Slippage/);
});

test('accepts slippage within tolerance', async () => {
  const rm = makeManager();
  const res = await rm.check(
    baseIntent({ price: 100 }),
    baseState({ currentPrice: 101 }), // 1% slippage
  );
  assert.equal(res.approved, true);
});

// ── Force-close ────────────────────────────────────────────────────────────

test('forceCloseIfNeeded closes positions at -20% unrealized', async () => {
  const rm = makeManager();
  const closed = [];
  const closeFn = async (asset) => { closed.push(asset); };
  await rm.forceCloseIfNeeded(
    [
      { asset: 'BTC', unrealizedPnlPct: -25 },
      { asset: 'ETH', unrealizedPnlPct: -10 },
      { asset: 'SOL', unrealizedPnlPct: -21 },
    ],
    closeFn,
  );
  assert.deepEqual(closed.sort(), ['BTC', 'SOL']);
});

test('forceCloseIfNeeded ignores positions within threshold', async () => {
  const rm = makeManager();
  const closed = [];
  await rm.forceCloseIfNeeded(
    [{ asset: 'BTC', unrealizedPnlPct: -15 }],
    async (a) => { closed.push(a); },
  );
  assert.equal(closed.length, 0);
});

// ── Disabled mode ──────────────────────────────────────────────────────────

test('disabled mode approves all intents as-is', async () => {
  const rm = new RiskManager({}, { disabled: true, statePath: path.join(os.tmpdir(), `disabled_${Date.now()}.json`) });
  const res = await rm.check(baseIntent({ allocationUsd: 999999, leverage: 100 }), baseState({ balance: 10 }));
  assert.equal(res.approved, true);
  assert.equal(res.adjustedIntent.allocationUsd, 999999);
});

// ── Cleanup ────────────────────────────────────────────────────────────────

test('cleanup: remove logger stub', () => {
  try { fs.unlinkSync(stubPath); } catch {}
  assert.ok(true);
});
