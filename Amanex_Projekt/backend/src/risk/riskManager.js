// ── GLOBAL RISK MANAGER
// Exchange-agnostisches Safety-Gate fuer alle drei Exchanges (Binance, Kraken, Hyperliquid).
// Port der Logik von sanketagarwal/hyperliquid-trading-agent src/risk_manager.py
// angepasst auf Amanex CommonJS-Patterns.
//
// Defaults entsprechen den ORIGINALEN (strengeren) Werten des Upstream-Repos,
// nicht den gelockerten nach 2026-04-07 — fuer Amanex ist konservativ sicherer.
//
// Prinzip: "Cap statt Reject". Wenn eine Allocation die Grenze ueberschreitet,
// wird sie auf das Limit reduziert und mit {approved:true, adjustedIntent:...}
// zurueckgegeben. Nur harte Verstoesse (Circuit Breaker, Reserve, Min-Size,
// Max Concurrent) fuehren zu einem echten Reject.

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const notifier = require('../utils/notifier');

// ── DEFAULTS ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  MAX_POSITION_PCT: 10,                // Max 10% Equity pro Position
  MAX_LOSS_PER_POSITION_PCT: 20,       // Force-Close bei -20% Unrealized
  MAX_LEVERAGE: 10,                    // 10x Cap (nur Perps relevant)
  MAX_TOTAL_EXPOSURE_PCT: 50,          // Summe offener Positionen ≤ 50% Equity
  DAILY_LOSS_CIRCUIT_BREAKER_PCT: 10,  // -10% Tag → alle neuen Trades blockiert
  MIN_BALANCE_RESERVE_PCT: 20,         // 20% der Initial-Balance immer frei
  MANDATORY_SL_PCT: 5,                 // Auto-SL bei 5% unter Entry wenn fehlt
  MAX_CONCURRENT_POSITIONS: 10,
  MIN_ORDER_SIZE_USD: 11,              // Hyperliquid-Floor ist $10
  MAX_SLIPPAGE_PCT: 2,                 // Bestehender Amanex-Wert, jetzt zentral
};

// Env-Override-Keys (optional, sonst Defaults)
function loadConfig(overrides = {}) {
  const env = process.env;
  const cfg = { ...DEFAULTS };
  const envMap = {
    MAX_POSITION_PCT: 'RISK_MAX_POSITION_PCT',
    MAX_LOSS_PER_POSITION_PCT: 'RISK_MAX_LOSS_PER_POSITION_PCT',
    MAX_LEVERAGE: 'RISK_MAX_LEVERAGE',
    MAX_TOTAL_EXPOSURE_PCT: 'RISK_MAX_TOTAL_EXPOSURE_PCT',
    DAILY_LOSS_CIRCUIT_BREAKER_PCT: 'RISK_DAILY_CIRCUIT_BREAKER_PCT',
    MIN_BALANCE_RESERVE_PCT: 'RISK_MIN_BALANCE_RESERVE_PCT',
    MANDATORY_SL_PCT: 'RISK_MANDATORY_SL_PCT',
    MAX_CONCURRENT_POSITIONS: 'RISK_MAX_CONCURRENT_POSITIONS',
    MIN_ORDER_SIZE_USD: 'RISK_MIN_ORDER_SIZE_USD',
    MAX_SLIPPAGE_PCT: 'RISK_MAX_SLIPPAGE_PCT',
  };
  for (const [key, envKey] of Object.entries(envMap)) {
    if (env[envKey] !== undefined) {
      const n = parseFloat(env[envKey]);
      if (Number.isFinite(n)) cfg[key] = n;
    }
  }
  return { ...cfg, ...overrides };
}

// ── CIRCUIT-BREAKER-STATE ─────────────────────────────────────────────────
// Persistiert nur den Tagesbeginn-Equity-Wert und ein Flag.
// Resettet automatisch bei UTC-Tagesrollover.

function utcDayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

class CircuitBreakerState {
  constructor(statePath) {
    this.statePath = statePath || path.resolve(process.cwd(), 'risk_state.json');
    this.cache = null;
  }

  load() {
    if (this.cache) return this.cache;
    try {
      if (fs.existsSync(this.statePath)) {
        this.cache = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      } else {
        this.cache = { day: utcDayKey(), startEquity: null, tripped: false };
      }
    } catch (err) {
      logger.warn('RiskManager state load failed, starting fresh', { message: err.message });
      this.cache = { day: utcDayKey(), startEquity: null, tripped: false };
    }
    return this.cache;
  }

  save() {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.cache, null, 2));
    } catch (err) {
      logger.warn('RiskManager state save failed', { message: err.message });
    }
  }

  // Wird bei jedem check() aufgerufen, rollt den Tag falls noetig.
  touch(currentEquity) {
    const today = utcDayKey();
    const s = this.load();
    if (s.day !== today) {
      s.day = today;
      s.startEquity = currentEquity;
      s.tripped = false;
      this.save();
    } else if (s.startEquity === null && Number.isFinite(currentEquity)) {
      s.startEquity = currentEquity;
      this.save();
    }
    return s;
  }

  trip() {
    const s = this.load();
    s.tripped = true;
    this.save();
  }

  isTripped() {
    return !!this.load().tripped;
  }
}

// ── RISK MANAGER ──────────────────────────────────────────────────────────

class RiskManager {
  constructor(overrides = {}, opts = {}) {
    this.config = loadConfig(overrides);
    this.state = new CircuitBreakerState(opts.statePath);
    this.disabled = !!opts.disabled; // Fuer Phase-1-Rollout: no-op mode
  }

  // ── Einzelne Guards (jeder gibt {ok:bool, reason?:string, adjust?:{...}}) ──

  checkMinOrderSize(intent) {
    if (intent.allocationUsd < this.config.MIN_ORDER_SIZE_USD) {
      return { ok: false, reason: `Allocation ${intent.allocationUsd} < MIN_ORDER_SIZE_USD ${this.config.MIN_ORDER_SIZE_USD}` };
    }
    return { ok: true };
  }

  checkLeverageCap(intent) {
    const lev = intent.leverage || 1;
    if (lev > this.config.MAX_LEVERAGE) {
      return { ok: true, adjust: { leverage: this.config.MAX_LEVERAGE } };
    }
    return { ok: true };
  }

  checkMaxPosition(intent, state) {
    const equity = state.equity || state.balance || 0;
    if (equity <= 0) return { ok: false, reason: 'No equity available' };
    const cap = equity * (this.config.MAX_POSITION_PCT / 100);
    if (intent.allocationUsd > cap) {
      return { ok: true, adjust: { allocationUsd: cap } };
    }
    return { ok: true };
  }

  checkTotalExposure(intent, state) {
    const equity = state.equity || state.balance || 0;
    const openExposure = (state.openPositions || [])
      .reduce((sum, p) => sum + Math.abs(p.notionalUsd || 0), 0);
    const capTotal = equity * (this.config.MAX_TOTAL_EXPOSURE_PCT / 100);
    const remaining = capTotal - openExposure;
    if (remaining <= 0) {
      return { ok: false, reason: `Total exposure ${openExposure.toFixed(2)} already at cap ${capTotal.toFixed(2)}` };
    }
    if (intent.allocationUsd > remaining) {
      return { ok: true, adjust: { allocationUsd: remaining } };
    }
    return { ok: true };
  }

  checkBalanceReserve(intent, state) {
    const initial = state.initialBalance || state.equity || state.balance || 0;
    const reserve = initial * (this.config.MIN_BALANCE_RESERVE_PCT / 100);
    const free = state.balance - intent.allocationUsd;
    if (free < reserve) {
      return { ok: false, reason: `Balance reserve ${reserve.toFixed(2)} would be violated (free after trade: ${free.toFixed(2)})` };
    }
    return { ok: true };
  }

  checkDailyCircuitBreaker(state) {
    this.state.touch(state.equity || state.balance || 0);
    if (this.state.isTripped()) {
      return { ok: false, reason: 'Daily circuit breaker already tripped today' };
    }
    const s = this.state.load();
    if (s.startEquity && s.startEquity > 0) {
      const equity = state.equity || state.balance || 0;
      const dayPct = ((equity - s.startEquity) / s.startEquity) * 100;
      if (dayPct <= -this.config.DAILY_LOSS_CIRCUIT_BREAKER_PCT) {
        this.state.trip();
        return { ok: false, reason: `Daily circuit breaker triggered (${dayPct.toFixed(2)}%)` };
      }
    }
    return { ok: true };
  }

  checkMaxConcurrent(state) {
    const count = (state.openPositions || []).length;
    if (count >= this.config.MAX_CONCURRENT_POSITIONS) {
      return { ok: false, reason: `Max concurrent positions ${count}/${this.config.MAX_CONCURRENT_POSITIONS}` };
    }
    return { ok: true };
  }

  checkMandatoryStopLoss(intent) {
    if (intent.slPrice !== undefined && intent.slPrice !== null) return { ok: true };
    if (!intent.price) return { ok: true }; // kein Ref-Preis → kann nicht setzen
    const isBuy = intent.side === 'yes' || intent.side === 'buy' || intent.side === 'BUY';
    const pct = this.config.MANDATORY_SL_PCT / 100;
    const slPrice = isBuy ? intent.price * (1 - pct) : intent.price * (1 + pct);
    return { ok: true, adjust: { slPrice } };
  }

  checkSlippage(intent, state) {
    if (!intent.price || !state.currentPrice) return { ok: true };
    const slippage = Math.abs(state.currentPrice - intent.price) / intent.price;
    if (slippage > this.config.MAX_SLIPPAGE_PCT / 100) {
      return { ok: false, reason: `Slippage ${(slippage * 100).toFixed(2)}% > ${this.config.MAX_SLIPPAGE_PCT}%` };
    }
    return { ok: true };
  }

  // ── Haupt-Gate ──────────────────────────────────────────────────────────

  async check(intent, state) {
    if (this.disabled) return { approved: true, adjustedIntent: intent, reason: 'risk manager disabled' };

    const adjusted = { ...intent };
    const adjustments = [];

    // Guards werden sequenziell gegen `adjusted` gefahren, damit spaetere Guards
    // die Ergebnisse frueherer Caps sehen (z.B. Balance-Reserve nach Position-Cap).
    const guards = [
      (a) => this.checkDailyCircuitBreaker(state),
      (a) => this.checkMaxConcurrent(state),
      (a) => this.checkMinOrderSize(a),
      (a) => this.checkSlippage(a, state),
      (a) => this.checkLeverageCap(a),
      (a) => this.checkMaxPosition(a, state),
      (a) => this.checkTotalExposure(a, state),
      (a) => this.checkBalanceReserve(a, state),
      (a) => this.checkMandatoryStopLoss(a),
    ];

    for (const guard of guards) {
      const res = guard(adjusted);
      if (!res.ok) {
        return { approved: false, reason: res.reason, adjustedIntent: null };
      }
      if (res.adjust) {
        Object.assign(adjusted, res.adjust);
        adjustments.push(res.adjust);
      }
    }

    // Final-Pass: nach allen Caps muss die Order noch die Mindestgroesse erfuellen.
    // Wenn nicht (z.B. wegen aggressivem Max-Position-Cap auf kleinem Account),
    // wird die Order abgelehnt — ein 5-USD-Trade macht keinen Sinn.
    const finalSize = this.checkMinOrderSize(adjusted);
    if (!finalSize.ok) {
      return { approved: false, reason: `After cap: ${finalSize.reason}`, adjustedIntent: null };
    }

    return { approved: true, adjustedIntent: adjusted, adjustments };
  }

  // ── Post-Trade: Force-Close bei -MAX_LOSS_PER_POSITION_PCT% ──────────
  // Scanner ruft das pro Exchange auf. `closePositionFn(asset)` wird vom
  // Adapter-Modul bereitgestellt (z.B. hyperliquid.closePosition).

  async forceCloseIfNeeded(positions, closePositionFn) {
    const closed = [];
    for (const pos of positions || []) {
      const pnlPct = pos.unrealizedPnlPct !== undefined
        ? pos.unrealizedPnlPct
        : (pos.pnl && pos.notionalUsd ? (pos.pnl / pos.notionalUsd) * 100 : null);
      if (pnlPct !== null && pnlPct <= -this.config.MAX_LOSS_PER_POSITION_PCT) {
        try {
          logger.warn('Force-close triggered', { asset: pos.asset, pnlPct: pnlPct.toFixed(2) });
          await closePositionFn(pos.asset);
          closed.push({ asset: pos.asset, pnlPct });
          notifier.tradeClosed({
            market: pos.asset,
            pnl: pos.pnl || 0,
            close_reason: `force-close ${pnlPct.toFixed(2)}% <= -${this.config.MAX_LOSS_PER_POSITION_PCT}%`,
          });
        } catch (err) {
          logger.error('Force-close failed', { asset: pos.asset, message: err.message });
        }
      }
    }
    return closed;
  }
}

module.exports = { RiskManager, DEFAULTS, loadConfig };
