const binance = require('../api/binance');
const kraken = require('../api/kraken');
const db = require('../utils/db');
const logger = require('../utils/logger');

const executor = {
  async run(markets) {
    logger.info('Executor gestartet', { markets: markets.length });
    const results = [];
    for (const market of markets) {
      if (!market.riskApproved) continue;
      try {
        let result;
        if (market.platform === 'binance') result = await this.executeBinance(market);
        else if (market.platform === 'kraken') result = await this.executeKraken(market);
        else if (market.type === 'stock') result = await this.createStockRecommendation(market);
        if (result) results.push(result);
      } catch (error) {
        logger.error('Trade Fehler', { market: market.id, message: error.message });
      }
    }
    logger.info('Executor abgeschlossen', { executed: results.length });
    return results;
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
