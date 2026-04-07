const binance = require('../api/binance');
const kraken = require('../api/kraken');
const hyperliquid = require('../api/hyperliquid');
const { RiskManager } = require('../risk/riskManager');
const db = require('../utils/db');
const logger = require('../utils/logger');

// Globaler RiskManager — eine Instanz fuer alle Exchanges.
// Phase-1-Rollout: nur Hyperliquid laeuft durch das Gate. Fuer Binance/Kraken
// wird der bestehende market.riskApproved-Pfad beibehalten, damit sich an der
// aktuellen Signalqualitaet nichts aendert. Sobald die erweiterten Signale
// validiert sind, kann das Gate per RISK_GATE_ALL=1 fuer alle Plattformen
// scharf geschaltet werden.
const risk = new RiskManager();
const RISK_GATE_ALL = process.env.RISK_GATE_ALL === '1';

const executor = {
  async run(markets) {
    logger.info('Executor gestartet', { markets: markets.length });
    const results = [];
    for (const market of markets) {
      // Gate 1 — bestehende Backend-Risk-Approval (Binance/Kraken/Stocks)
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
        if (executableMarket.platform === 'binance') result = await this.executeBinance(executableMarket);
        else if (executableMarket.platform === 'kraken') result = await this.executeKraken(executableMarket);
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
        return {
          balance: value,
          equity: value,
          initialBalance: value, // TODO: aus DB lesen fuer echte Reserve-Checks
          openPositions: positions,
          currentPrice,
        };
      }
      if (platform === 'binance') {
        const [balance, currentPrice] = await Promise.all([
          binance.getUSDTBalance(),
          binance.getPrice(market.id),
        ]);
        return {
          balance, equity: balance, initialBalance: balance,
          openPositions: [], currentPrice,
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

  async executeBinance(market) {
    const { id, signal, positionSize, price } = market;
    if (signal !== 'BUY' && signal !== 'SELL') return null;
    const side = signal === 'BUY' ? 'BUY' : 'SELL';
    const quantity = positionSize / price;
    try {
      const currentPrice = await binance.getPrice(id);
      if (currentPrice) {
        const slippage = Math.abs(currentPrice - price) / price;
        if (slippage > 0.02) {
          logger.warn('Binance Slippage zu gross', { expected: price, current: currentPrice });
          return null;
        }
      }
      const order = await binance.placeMarketOrder({ symbol: id, side, quantity });
      const trade = await db.saveTrade({
        market_id: id, platform: 'binance', market_title: market.title,
        side: side === 'BUY' ? 'yes' : 'no', amount: positionSize, contracts: 1,
        entry_price: currentPrice || price, ai_consensus: market.consensus,
        edge_pct: market.edge, status: 'open',
        order_id: order?.orderId?.toString(), created_at: new Date().toISOString(),
      });
      logger.info('Binance Trade erfolgreich', { tradeId: trade.id, symbol: id, side });
      return trade;
    } catch (error) {
      logger.error('Binance Trade fehlgeschlagen', { symbol: id, message: error.message });
      return null;
    }
  },

  async executeKraken(market) {
    const { id, signal, positionSize, price } = market;
    if (signal !== 'BUY' && signal !== 'SELL') return null;
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
      if (trade.platform === 'binance') {
        const side = trade.side === 'yes' ? 'SELL' : 'BUY';
        const quantity = trade.amount / trade.entry_price;
        await binance.placeMarketOrder({ symbol: trade.market_id, side, quantity });
      } else if (trade.platform === 'kraken') {
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
