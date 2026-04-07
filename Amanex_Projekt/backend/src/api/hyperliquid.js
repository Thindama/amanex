// ── HYPERLIQUID API ADAPTER
// Perps-DEX (Crypto + HIP-3 fuer Stocks/Commodities/Forex wie xyz:TSLA, xyz:GOLD).
// Port der Logik von sanketagarwal/hyperliquid-trading-agent src/trading/hyperliquid_api.py
// angepasst auf das Amanex Adapter-Interface (gleiche Methoden wie binance.js).
//
// Interne Signing-Logik lebt in hyperliquidClient.js — dieses Modul liefert
// nur die "Scanner/Executor-freundlichen" Methoden mit normalisierten Outputs.

'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const client = require('./hyperliquidClient');

const INTERVAL_MAP = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '8h': '8h',
  '12h': '12h',
  '1d': '1d',
  '1w': '1w',
};

function intervalToMs(interval) {
  const map = {
    '1m': 60e3, '3m': 3 * 60e3, '5m': 5 * 60e3, '15m': 15 * 60e3,
    '30m': 30 * 60e3, '1h': 3600e3, '2h': 2 * 3600e3, '4h': 4 * 3600e3,
    '8h': 8 * 3600e3, '12h': 12 * 3600e3, '1d': 86400e3, '1w': 7 * 86400e3,
  };
  return map[interval] || 3600e3;
}

function normalizeCandle(c) {
  // @nktkas liefert {t, T, s, i, o, c, h, l, v, n}
  return {
    openTime: c.t,
    open: parseFloat(c.o),
    high: parseFloat(c.h),
    low: parseFloat(c.l),
    close: parseFloat(c.c),
    volume: parseFloat(c.v),
    closeTime: c.T,
  };
}

const hyperliquid = {
  // ── MARKTDATEN ───────────────────────────────────────────────────────

  async getExchangeInfo() {
    try {
      const meta = await client.getMeta();
      if (!meta || !meta[0]) return null;
      const universe = meta[0].universe || [];
      return {
        symbols: universe.map(u => ({
          symbol: u.name,
          szDecimals: u.szDecimals,
          maxLeverage: u.maxLeverage,
        })),
        baseAssets: universe.map(u => u.name),
      };
    } catch (err) {
      logger.error('Hyperliquid getExchangeInfo Fehler', { message: err.message });
      return null;
    }
  },

  async getPrice(asset) {
    try {
      const { info } = client.init();
      if (!info) return null;
      const dex = client.extractDex(asset);
      const mids = dex ? await info.allMids({ dex }) : await info.allMids();
      const price = mids[asset];
      return price ? parseFloat(price) : null;
    } catch (err) {
      logger.error('Hyperliquid getPrice Fehler', { asset, message: err.message });
      return null;
    }
  },

  async get24hStats(asset) {
    try {
      const meta = await client.getMeta();
      if (!meta || !meta[0] || !meta[1]) return null;
      const universe = meta[0].universe;
      const ctxs = meta[1];
      const idx = universe.findIndex(u => u.name === asset);
      if (idx < 0) return null;
      const ctx = ctxs[idx];
      if (!ctx) return null;
      const lastPrice = parseFloat(ctx.markPx || ctx.midPx || 0);
      const prevDay = parseFloat(ctx.prevDayPx || lastPrice);
      const change = lastPrice - prevDay;
      const changePct = prevDay > 0 ? (change / prevDay) * 100 : 0;
      return {
        lastPrice,
        priceChangePercent: changePct,
        quoteVolume: parseFloat(ctx.dayNtlVlm || 0),
        openInterest: parseFloat(ctx.openInterest || 0),
        funding: parseFloat(ctx.funding || 0),
      };
    } catch (err) {
      logger.error('Hyperliquid get24hStats Fehler', { asset, message: err.message });
      return null;
    }
  },

  async getKlines(asset, interval = '1h', limit = 100) {
    try {
      const { info } = client.init();
      if (!info) return [];
      const mapped = INTERVAL_MAP[interval] || '1h';
      const now = Date.now();
      const startTime = now - limit * intervalToMs(mapped);
      const dex = client.extractDex(asset);
      const candles = await info.candleSnapshot({
        coin: asset,
        interval: mapped,
        startTime,
        endTime: now,
        ...(dex ? { dex } : {}),
      });
      return (candles || []).map(normalizeCandle);
    } catch (err) {
      logger.error('Hyperliquid getKlines Fehler', { asset, message: err.message });
      return [];
    }
  },

  async getOrderBook(asset, limit = 10) {
    try {
      const { info } = client.init();
      if (!info) return null;
      const book = await info.l2Book({ coin: asset });
      if (!book || !book.levels) return null;
      const [bids, asks] = book.levels;
      return {
        bids: (bids || []).slice(0, limit).map(l => [parseFloat(l.px), parseFloat(l.sz)]),
        asks: (asks || []).slice(0, limit).map(l => [parseFloat(l.px), parseFloat(l.sz)]),
      };
    } catch (err) {
      logger.error('Hyperliquid getOrderBook Fehler', { asset, message: err.message });
      return null;
    }
  },

  async getFundingRate(asset) {
    const stats = await this.get24hStats(asset);
    return stats?.funding ?? 0;
  },

  async getOpenInterest(asset) {
    const stats = await this.get24hStats(asset);
    return stats?.openInterest ?? 0;
  },

  async getTopPairs(limit = 20) {
    try {
      const meta = await client.getMeta();
      if (!meta || !meta[0] || !meta[1]) return [];
      const universe = meta[0].universe;
      const ctxs = meta[1];
      const pairs = universe.map((u, i) => ({
        symbol: u.name,
        quoteVolume: parseFloat(ctxs[i]?.dayNtlVlm || 0),
      }));
      return pairs
        .filter(p => p.quoteVolume > 0)
        .sort((a, b) => b.quoteVolume - a.quoteVolume)
        .slice(0, limit);
    } catch (err) {
      logger.error('Hyperliquid getTopPairs Fehler', { message: err.message });
      return [];
    }
  },

  // ── ACCOUNT ──────────────────────────────────────────────────────────

  async getBalance() {
    try {
      const { info } = client.init();
      if (!info) return {};
      const userAddr = config.HYPERLIQUID_VAULT_ADDRESS;
      if (!userAddr) return {};
      const state = await info.clearinghouseState({ user: userAddr });
      const account = parseFloat(state?.marginSummary?.accountValue || 0);
      const withdrawable = parseFloat(state?.withdrawable || 0);
      return {
        USDC: { free: withdrawable, locked: Math.max(0, account - withdrawable) },
      };
    } catch (err) {
      logger.error('Hyperliquid getBalance Fehler', { message: err.message });
      return {};
    }
  },

  // Amanex-Alias: viele Code-Pfade fragen nach USDT — Hyperliquid nutzt USDC
  async getUSDTBalance() {
    const bal = await this.getBalance();
    return bal.USDC?.free || 0;
  },

  async getAccountValue() {
    try {
      const { info } = client.init();
      if (!info) return 0;
      const userAddr = config.HYPERLIQUID_VAULT_ADDRESS;
      if (!userAddr) return 0;
      const state = await info.clearinghouseState({ user: userAddr });
      return parseFloat(state?.marginSummary?.accountValue || 0);
    } catch (err) {
      logger.error('Hyperliquid getAccountValue Fehler', { message: err.message });
      return 0;
    }
  },

  async getOpenPositions() {
    try {
      const { info } = client.init();
      if (!info) return [];
      const userAddr = config.HYPERLIQUID_VAULT_ADDRESS;
      if (!userAddr) return [];
      const state = await info.clearinghouseState({ user: userAddr });
      const positions = state?.assetPositions || [];
      return positions
        .map(p => p.position)
        .filter(p => p && parseFloat(p.szi) !== 0)
        .map(p => {
          const szi = parseFloat(p.szi);
          const entry = parseFloat(p.entryPx || 0);
          const notional = parseFloat(p.positionValue || Math.abs(szi * entry));
          const pnl = parseFloat(p.unrealizedPnl || 0);
          return {
            asset: p.coin,
            size: szi,
            side: szi > 0 ? 'long' : 'short',
            entryPrice: entry,
            notionalUsd: notional,
            pnl,
            unrealizedPnlPct: notional > 0 ? (pnl / notional) * 100 : 0,
            leverage: parseFloat(p.leverage?.value || 1),
          };
        });
    } catch (err) {
      logger.error('Hyperliquid getOpenPositions Fehler', { message: err.message });
      return [];
    }
  },

  async getOpenOrders(asset = null) {
    try {
      const { info } = client.init();
      if (!info) return [];
      const userAddr = config.HYPERLIQUID_VAULT_ADDRESS;
      if (!userAddr) return [];
      const orders = await info.frontendOpenOrders({ user: userAddr });
      return (orders || []).filter(o => !asset || o.coin === asset);
    } catch (err) {
      logger.error('Hyperliquid getOpenOrders Fehler', { message: err.message });
      return [];
    }
  },

  // ── TRADING ──────────────────────────────────────────────────────────

  async placeMarketOrder({ asset, side, quantity, slippage = 0.01 }) {
    try {
      const { exchange } = client.init();
      if (!exchange) throw new Error('Hyperliquid exchange client not initialized');
      const isBuy = side === 'buy' || side === 'BUY' || side === 'yes';
      const size = await this.roundSize(asset, quantity);
      const result = await exchange.marketOpen({
        coin: asset,
        is_buy: isBuy,
        sz: size,
        slippage,
      });
      logger.info('Hyperliquid Market Order platziert', {
        asset, side: isBuy ? 'buy' : 'sell', size,
      });
      return { orderId: this._extractOid(result), status: 'placed', raw: result };
    } catch (err) {
      logger.error('Hyperliquid placeMarketOrder Fehler', { asset, message: err.message });
      throw err;
    }
  },

  async placeLimitOrder({ asset, side, quantity, price, tif = 'Gtc' }) {
    try {
      const { exchange } = client.init();
      if (!exchange) throw new Error('Hyperliquid exchange client not initialized');
      const isBuy = side === 'buy' || side === 'BUY' || side === 'yes';
      const size = await this.roundSize(asset, quantity);
      const result = await exchange.order({
        orders: [{
          coin: asset,
          is_buy: isBuy,
          sz: size,
          limit_px: price,
          order_type: { limit: { tif } },
          reduce_only: false,
        }],
        grouping: 'na',
      });
      logger.info('Hyperliquid Limit Order platziert', { asset, price, size });
      return { orderId: this._extractOid(result), status: 'placed', raw: result };
    } catch (err) {
      logger.error('Hyperliquid placeLimitOrder Fehler', { asset, message: err.message });
      throw err;
    }
  },

  async placeTakeProfit({ asset, isBuy, quantity, tpPrice }) {
    try {
      const { exchange } = client.init();
      if (!exchange) throw new Error('Hyperliquid exchange client not initialized');
      const size = await this.roundSize(asset, quantity);
      // Exit-Order: wenn Position long (isBuy=true), ist TP eine SELL reduce-only
      const result = await exchange.order({
        orders: [{
          coin: asset,
          is_buy: !isBuy,
          sz: size,
          limit_px: tpPrice,
          order_type: { trigger: { triggerPx: tpPrice, isMarket: true, tpsl: 'tp' } },
          reduce_only: true,
        }],
        grouping: 'na',
      });
      return { orderId: this._extractOid(result), raw: result };
    } catch (err) {
      logger.error('Hyperliquid placeTakeProfit Fehler', { asset, message: err.message });
      throw err;
    }
  },

  async placeStopLoss({ asset, isBuy, quantity, slPrice }) {
    try {
      const { exchange } = client.init();
      if (!exchange) throw new Error('Hyperliquid exchange client not initialized');
      const size = await this.roundSize(asset, quantity);
      const result = await exchange.order({
        orders: [{
          coin: asset,
          is_buy: !isBuy,
          sz: size,
          limit_px: slPrice,
          order_type: { trigger: { triggerPx: slPrice, isMarket: true, tpsl: 'sl' } },
          reduce_only: true,
        }],
        grouping: 'na',
      });
      return { orderId: this._extractOid(result), raw: result };
    } catch (err) {
      logger.error('Hyperliquid placeStopLoss Fehler', { asset, message: err.message });
      throw err;
    }
  },

  async cancelOrder(asset, oid) {
    try {
      const { exchange } = client.init();
      if (!exchange) return false;
      await exchange.cancel({ cancels: [{ coin: asset, o: oid }] });
      logger.info('Hyperliquid Order storniert', { asset, oid });
      return true;
    } catch (err) {
      logger.error('Hyperliquid cancelOrder Fehler', { asset, oid, message: err.message });
      return false;
    }
  },

  async cancelAllOrders(asset) {
    try {
      const orders = await this.getOpenOrders(asset);
      for (const o of orders) {
        await this.cancelOrder(asset, o.oid);
      }
      return orders.length;
    } catch (err) {
      logger.error('Hyperliquid cancelAllOrders Fehler', { asset, message: err.message });
      return 0;
    }
  },

  async setLeverage(asset, leverage, isCross = true) {
    try {
      const { exchange } = client.init();
      if (!exchange) return false;
      await exchange.updateLeverage({
        coin: asset,
        is_cross: isCross,
        leverage: Math.floor(leverage),
      });
      return true;
    } catch (err) {
      logger.error('Hyperliquid setLeverage Fehler', { asset, leverage, message: err.message });
      return false;
    }
  },

  async closePosition(asset) {
    try {
      const positions = await this.getOpenPositions();
      const pos = positions.find(p => p.asset === asset);
      if (!pos) return null;
      const { exchange } = client.init();
      if (!exchange) return null;
      const result = await exchange.marketClose({ coin: asset });
      logger.info('Hyperliquid Position geschlossen', { asset, size: pos.size });
      return result;
    } catch (err) {
      logger.error('Hyperliquid closePosition Fehler', { asset, message: err.message });
      return null;
    }
  },

  // ── HILFSFUNKTIONEN ──────────────────────────────────────────────────

  isHip3(asset) {
    return client.isHip3(asset);
  },

  toSymbol(asset) {
    // Hyperliquid braucht keinen Suffix — Asset-Name ist direkt das Symbol.
    return asset;
  },

  async roundSize(asset, amount) {
    try {
      const decimals = await client.getSzDecimals(asset);
      const factor = Math.pow(10, decimals);
      return Math.floor(amount * factor) / factor;
    } catch {
      return Number(amount.toFixed(4));
    }
  },

  _extractOid(result) {
    try {
      const statuses = result?.response?.data?.statuses;
      if (!statuses || !statuses.length) return null;
      const first = statuses[0];
      return first.resting?.oid || first.filled?.oid || null;
    } catch {
      return null;
    }
  },

  // ── Einfache RSI/Volatility fuer Fallback im Scanner ────────────────
  // (wie in binance.js, nur um bei gleichem Interface zu bleiben)

  calculateVolatility(klines) {
    if (!klines || klines.length < 2) return 0;
    const returns = klines.slice(1).map((k, i) => (k.close - klines[i].close) / klines[i].close);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  },

  calculateRSI(klines, period = 14) {
    if (!klines || klines.length < period + 1) return 50;
    const closes = klines.map(k => k.close);
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  },
};

module.exports = hyperliquid;
