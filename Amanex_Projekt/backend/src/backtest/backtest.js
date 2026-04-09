// ── BACKTEST-ENGINE
// Replayed historische Kraken-OHLCV-Kerzen gegen die gleiche RSI/MACD-Logik,
// die auch scanner.js + prediction.js verwenden — damit Parameter (Entry-
// Schwellen, RR, Position-Size) offline validiert werden koennen, ohne dass
// echtes Kapital riskiert wird.
//
// Bewusst minimal: keine Slippage-Modellierung ueber Fixkosten hinaus, keine
// Funding-Kosten fuer Perps. Ziel ist Parameter-Selektion, nicht PnL-Prognose.
//
// CLI:
//   node src/backtest/backtest.js --pair XBTEUR --interval 60 --rsi-buy 35 --rsi-sell 65
// oder programmatic: require('./backtest').run({...})

'use strict';

const kraken = require('../api/kraken');
const indicators = require('../indicators/localIndicators');

const DEFAULTS = {
  pair:        'XBTEUR',
  interval:    60,     // Minuten
  rsiBuy:      35,
  rsiSell:     65,
  requireMacd: true,   // MACD-Histogram muss Richtung bestaetigen
  feeBps:      10,     // 0.10% pro Seite (konservativ fuer Kraken Taker)
  startEquity: 10000,
  riskPct:     2,      // 2% Equity pro Trade
  stopPct:     3,      // 3% Stop vom Entry
  takePct:     6,      // 6% Take-Profit (RR = 2)
};

function simulate(candles, opts) {
  const cfg = { ...DEFAULTS, ...opts };
  if (!candles || candles.length < 50) {
    return { error: 'Zu wenig Kerzen (min 50)', candles: candles?.length || 0 };
  }

  const ind = indicators.computeAll(candles);
  const rsiSeries = ind.rsi14 || [];
  const macdHist  = ind.macd?.histogram || [];

  let equity = cfg.startEquity;
  let peakEquity = equity;
  let maxDrawdown = 0;
  let position = null; // { side, entry, size, stop, take }
  const trades = [];

  for (let i = 30; i < candles.length; i++) {
    const c = candles[i];
    const rsi = rsiSeries[i];
    const mh  = macdHist[i] || 0;
    if (rsi == null) continue;

    // ── Exit-Check fuer offene Position
    if (position) {
      let exitPrice = null;
      let reason = null;
      if (position.side === 'long') {
        if (c.low  <= position.stop) { exitPrice = position.stop; reason = 'stop'; }
        else if (c.high >= position.take) { exitPrice = position.take; reason = 'take'; }
      } else {
        if (c.high >= position.stop) { exitPrice = position.stop; reason = 'stop'; }
        else if (c.low  <= position.take) { exitPrice = position.take; reason = 'take'; }
      }
      if (exitPrice != null) {
        const gross = position.side === 'long'
          ? (exitPrice - position.entry) * position.size
          : (position.entry - exitPrice) * position.size;
        const fee = (position.entry + exitPrice) * position.size * (cfg.feeBps / 10000);
        const pnl = gross - fee;
        equity += pnl;
        peakEquity = Math.max(peakEquity, equity);
        maxDrawdown = Math.max(maxDrawdown, (peakEquity - equity) / peakEquity);
        trades.push({
          side: position.side, entry: position.entry, exit: exitPrice,
          pnl: Math.round(pnl * 100) / 100, reason, time: c.time,
        });
        position = null;
      }
    }

    // ── Entry-Check
    if (!position) {
      let side = null;
      if (rsi < cfg.rsiBuy  && (!cfg.requireMacd || mh > 0)) side = 'long';
      else if (rsi > cfg.rsiSell && (!cfg.requireMacd || mh < 0)) side = 'short';
      if (side) {
        const riskAmount = equity * (cfg.riskPct / 100);
        const stopDist = c.close * (cfg.stopPct / 100);
        const size = riskAmount / stopDist;
        position = {
          side,
          entry: c.close,
          size,
          stop: side === 'long' ? c.close * (1 - cfg.stopPct / 100) : c.close * (1 + cfg.stopPct / 100),
          take: side === 'long' ? c.close * (1 + cfg.takePct / 100) : c.close * (1 - cfg.takePct / 100),
        };
      }
    }
  }

  const wins   = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl <= 0).length;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss   = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));

  return {
    config: cfg,
    candles: candles.length,
    trades: trades.length,
    wins,
    losses,
    winRate:    trades.length ? Math.round((wins / trades.length) * 1000) / 10 : 0,
    totalPnl:   Math.round(totalPnl * 100) / 100,
    finalEquity: Math.round(equity * 100) / 100,
    returnPct:  Math.round(((equity - cfg.startEquity) / cfg.startEquity) * 10000) / 100,
    profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : null,
    maxDrawdownPct: Math.round(maxDrawdown * 10000) / 100,
    tradeLog: trades.slice(-20),
  };
}

async function run(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const candles = await kraken.getOHLCV(cfg.pair, cfg.interval);
  return simulate(candles, cfg);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) { out[key] = true; continue; }
    out[key] = isNaN(Number(val)) ? val : Number(val);
    i++;
  }
  // map kebab-case to camelCase
  const map = {
    'rsi-buy': 'rsiBuy', 'rsi-sell': 'rsiSell', 'require-macd': 'requireMacd',
    'fee-bps': 'feeBps', 'start-equity': 'startEquity', 'risk-pct': 'riskPct',
    'stop-pct': 'stopPct', 'take-pct': 'takePct',
  };
  for (const [k, v] of Object.entries(map)) {
    if (out[k] !== undefined) { out[v] = out[k]; delete out[k]; }
  }
  return out;
}

if (require.main === module) {
  const opts = parseArgs(process.argv);
  run(opts).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error('Backtest Fehler:', err.message);
    process.exit(1);
  });
}

module.exports = { run, simulate, DEFAULTS };
