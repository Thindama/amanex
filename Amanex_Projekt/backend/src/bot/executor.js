const kraken = require('../api/kraken');
const hyperliquid = require('../api/hyperliquid');
const { RiskManager } = require('../risk/riskManager');
const config = require('../config');
const db = require('../utils/db');
const logger = require('../utils/logger');

// Globaler RiskManager — eine Instanz fuer alle Exchanges.
// Phase-1-Rollout: nur Hyperliquid laeuft durch das Gate. Fuer Kraken
// wird der bestehende market.riskApproved-Pfad beibehalten, damit sich an der
// aktuellen Signalqualitaet nichts aendert. Sobald die erweiterten Signale
// validiert sind, kann das Gate per RISK_GATE_ALL=1 fuer alle Plattformen
// scharf geschaltet werden.
const risk = new RiskManager();
const RISK_GATE_ALL = config.RISK_GATE_ALL;

// prediction.js vergibt historisch BUY_YES / BUY_NO (Prediction-Market-Erbe).
// Der scanner vergibt BUY / SELL / HOLD. Die Trade-Branches unten erwarten
// strikt BUY / SELL. Damit beide Pfade funktionieren, wird das Signal hier
// einmalig normalisiert — ohne andere Felder anzufassen.
function normalizeSignal(raw) {
  const s = String(raw || '').toUpperCase();
  if (s === 'BUY' || s === 'BUY_YES' || s === 'KAUF' || s === 'LONG') return 'BUY';
  if (s === 'SELL' || s === 'BUY_NO' || s === 'VERK' || s === 'SHORT') return 'SELL';
  return 'HOLD';
}

const executor = {
  async run(markets) {
    logger.info('Executor gestartet', { markets: markets.length });
    const results = [];
    for (const rawMarket of markets) {
      // Signal normalisieren (BUY_YES/BUY_NO → BUY/SELL) bevor irgendetwas
      // am Market geprueft wird — damit Kraken- und Hyperliquid-Branches
      // beide mit dem gleichen Format arbeiten.
      const market = { ...rawMarket, signal: normalizeSignal(rawMarket.signal) };
      if (market.signal === 'HOLD') continue;

      // Gate 1 — bestehende Backend-Risk-Approval (Kraken/Stocks).
      // Fuer Hyperliquid ist das Feld in der Regel nicht gesetzt, also
      // springen wir direkt auf das lokale Gate.
      if (market.platform !== 'hyperliquid' && !RISK_GATE_ALL && !market.riskApproved) continue;

      try {
        // Gate 2 — globaler lokaler RiskManager (pflicht fuer Hyperliquid,
        // optional fuer andere via RISK_GATE_ALL)
        let executableMarket = market;
        if (market.platform === 'hyperliquid' || RISK_GATE_ALL) {
          const intent = this.marketToIntent(market);
          const state = await this.getStateFor(market.platform, market);
          const check = await risk.check(intent, state);
          if (!check.approved) {
            logger.info('Risk reject', { market: market.id, reason: check.reason });
            continue;
          }
          executableMarket = { ...market, ...check.adjustedIntent };
          if (check.adjustments && check.adjustments.length) {
            logger.info('Risk adjusted', { market: market.id, adjustments: check.adjustments });
          }
        }

        let result;
        if (executableMarket.platform === 'kraken') result = await this.executeKraken(executableMarket);
        else if (executableMarket.platform === 'hyperliquid') result = await this.executeHyperliquid(executableMarket);
        else if (executableMarket.type === 'stock' || executableMarket.type?.startsWith('stock')) result = await this.createStockRecommendation(executableMarket);
        if (result) results.push(result);
      } catch (error) {
        logger.error('Trade Fehler', { market: market.id, message: error.message });
      }
    }
    logger.info('Executor abgeschlossen', { executed: results.length });
    return results;
  },

  // ── Intent / State helpers ──────────────────────────────────────────

  marketToIntent(market) {
    return {
      exchange: market.platform,
      asset: market.id,
      side: market.signal === 'BUY' ? 'buy' : market.signal === 'SELL' ? 'sell' : 'hold',
      allocationUsd: market.positionSize || 0,
      leverage: market.leverage || (market.platform === 'hyperliquid' ? 3 : 1),
      price: market.price,
      slPrice: market._claudeSignal?.slPrice ?? null,
      tpPrice: market._claudeSignal?.tpPrice ?? null,
    };
  },

  async getStateFor(platform, market) {
    try {
      if (platform === 'hyperliquid') {
        const [value, positions, currentPrice] = await Promise.all([
          hyperliquid.getAccountValue(),
          hyperliquid.getOpenPositions(),
          hyperliquid.getPrice(market.id),
        ]);
        // Initial-Balance fuer den Reserve-Check aus bot_settings lesen.
        // Beim ersten Start (noch nicht gesetzt) wird der aktuelle Wert
        // als Baseline hinterlegt, damit die 20%-Reserve nicht dauerhaft
        // blockiert. Wir nehmen bewusst den aktuellen Account-Value — im
        // Testnet/Mainnet-Rollout soll der erste Scan als "Tag 0" gelten.
        let initialBalance = value;
        try {
          const settings = await db.getBotSettings();
          const stored = parseFloat(settings.hl_initial_balance);
          if (Number.isFinite(stored) && stored > 0) {
            initialBalance = stored;
          } else if (value > 0) {
            await db.supabase
              .from('bot_settings')
              .upsert({ key: 'hl_initial_balance', value: String(value), updated_at: new Date().toISOString() });
          }
        } catch (err) {
          logger.warn('hl_initial_balance read failed', { message: err.message });
        }
        return {
          balance: value,
          equity: value,
          initialBalance,
          openPositions: positions,
          currentPrice,
        };
      }
      if (platform === 'kraken') {
        const ticker = await kraken.getTicker(market.id);
        return {
          balance: 0, equity: 0, initialBalance: 0,
          openPositions: [], currentPrice: ticker?.price || market.price,
        };
      }
    } catch (err) {
      logger.warn('getStateFor failed', { platform, message: err.message });
    }
    return { balance: 0, equity: 0, initialBalance: 0, openPositions: [], currentPrice: market.price };
  },

  async executeKraken(market) {
    const { id, signal, positionSize, price } = market;
    if (signal !== 'BUY' && signal !== 'SELL') return null;
    // Gate: Ohne KRAKEN_API_KEY kann keine echte Order platziert werden.
    // Ohne diesen Gate schreibt saveTrade() Phantom-Trades in die DB, weil
    // Kraken bei Auth-Fehlern HTTP 200 + {error:[...], result:null} zurueckgibt
    // und placeOrder() damit keine Exception wirft. History/P&L verfaelscht.
    if (!config.KRAKEN_API_KEY || !config.KRAKEN_API_SECRET) {
      logger.info('Kraken Trade uebersprungen - keine API Keys', { pair: id, signal });
      return null;
    }
    const type = signal === 'BUY' ? 'buy' : 'sell';
    const volume = positionSize / price;
    try {
      const ticker = await kraken.getTicker(id);
      const currentPrice = ticker?.price || price;
      const slippage = Math.abs(currentPrice - price) / price;
      if (slippage > 0.02) {
        logger.warn('Kraken Slippage zu gross', { expected: price, current: currentPrice });
        return null;
      }
      await kraken.placeOrder({ pair: id, type, volume });
      const trade = await db.saveTrade({
        market_id: id, platform: 'kraken', market_title: market.title,
        side: type === 'buy' ? 'yes' : 'no', amount: positionSize, contracts: 1,
        entry_price: currentPrice, ai_consensus: market.consensus,
        edge_pct: market.edge, status: 'open', created_at: new Date().toISOString(),
      });
      logger.info('Kraken Trade erfolgreich', { tradeId: trade.id, pair: id, type });
      return trade;
    } catch (error) {
      logger.error('Kraken Trade fehlgeschlagen', { pair: id, message: error.message });
      return null;
    }
  },

  async executeHyperliquid(market) {
    const { id, signal, positionSize, price } = market;
    if (signal !== 'BUY' && signal !== 'SELL') return null;
    const allocationUsd = market.allocationUsd || positionSize;
    if (!allocationUsd || allocationUsd <= 0) {
      logger.warn('Hyperliquid: kein Allocation-Betrag', { asset: id });
      return null;
    }

    try {
      const currentPrice = (await hyperliquid.getPrice(id)) || price;
      const quantity = await hyperliquid.roundSize(id, allocationUsd / currentPrice);
      if (!quantity || quantity <= 0) {
        logger.warn('Hyperliquid: Quantity nach Rounding = 0', { asset: id, allocationUsd, currentPrice });
        return null;
      }

      // Leverage setzen (falls vom Risk-Manager angepasst)
      if (market.leverage) {
        await hyperliquid.setLeverage(id, market.leverage);
      }

      // Market-Order
      const side = signal === 'BUY' ? 'buy' : 'sell';
      const order = await hyperliquid.placeMarketOrder({
        asset: id, side, quantity, slippage: 0.01,
      });

      // TP/SL direkt mitschicken — SL ist vom RiskManager garantiert gesetzt
      const isBuy = side === 'buy';
      const tp = market.tpPrice ?? market._claudeSignal?.tpPrice;
      const sl = market.slPrice ?? market._claudeSignal?.slPrice;
      if (tp) {
        try { await hyperliquid.placeTakeProfit({ asset: id, isBuy, quantity, tpPrice: tp }); }
        catch (e) { logger.warn('TP-Platzierung fehlgeschlagen', { asset: id, message: e.message }); }
      }
      if (sl) {
        try { await hyperliquid.placeStopLoss({ asset: id, isBuy, quantity, slPrice: sl }); }
        catch (e) { logger.warn('SL-Platzierung fehlgeschlagen', { asset: id, message: e.message }); }
      }

      const trade = await db.saveTrade({
        market_id: id, platform: 'hyperliquid', market_title: market.title,
        side: side === 'buy' ? 'yes' : 'no', amount: allocationUsd, contracts: quantity,
        entry_price: currentPrice, ai_consensus: market.consensus,
        edge_pct: market.edge, status: 'open',
        order_id: order?.orderId?.toString(),
        leverage: market.leverage || null,
        tp_price: tp || null, sl_price: sl || null,
        created_at: new Date().toISOString(),
      });
      logger.info('Hyperliquid Trade erfolgreich', {
        tradeId: trade.id, asset: id, side, quantity, allocationUsd, leverage: market.leverage,
      });
      return trade;
    } catch (error) {
      logger.error('Hyperliquid Trade fehlgeschlagen', { asset: id, message: error.message });
      return null;
    }
  },

  async createStockRecommendation(market) {
    logger.info('Aktien-Empfehlung erstellt', { symbol: market.id, signal: market.signal });
    try {
      const trade = await db.saveTrade({
        market_id: market.id, platform: 'stocks',
        market_title: market.title + ' [MANUELL]',
        side: market.signal === 'BUY' ? 'yes' : 'no',
        amount: market.positionSize, contracts: 1,
        entry_price: market.price || 0, ai_consensus: market.consensus,
        edge_pct: market.edge, status: 'recommendation',
        created_at: new Date().toISOString(),
      });
      logger.info('Aktien-Empfehlung gespeichert', {
        symbol: market.id, action: market.signal, amount: Math.round(market.positionSize),
        platform: 'Trade Republic / Scalable Capital',
      });
      return trade;
    } catch (error) {
      logger.error('Aktien-Empfehlung Fehler', { symbol: market.id, message: error.message });
      return null;
    }
  },

  async closeTrade(trade, currentPrice) {
    try {
      if (trade.platform === 'kraken') {
        const type = trade.side === 'yes' ? 'sell' : 'buy';
        const volume = trade.amount / trade.entry_price;
        await kraken.placeOrder({ pair: trade.market_id, type, volume });
      } else if (trade.platform === 'hyperliquid') {
        await hyperliquid.closePosition(trade.market_id);
      }
      const pnl = (currentPrice - trade.entry_price) * (trade.side === 'yes' ? 1 : -1) * (trade.amount / trade.entry_price);
      await db.updateTrade(trade.id, {
        exit_price: currentPrice, pnl: Math.round(pnl * 100) / 100,
        status: 'closed', closed_at: new Date().toISOString(),
      });
      logger.info('Trade geschlossen', { tradeId: trade.id, pnl: Math.round(pnl) });
      return pnl;
    } catch (error) {
      logger.error('Trade schliessen Fehler', { tradeId: trade.id, message: error.message });
      return 0;
    }
  },
};

module.exports = executor;
