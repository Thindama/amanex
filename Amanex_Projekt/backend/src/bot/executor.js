const kalshi = require('../api/kalshi');
const polymarket = require('../api/polymarket');
const db = require('../utils/db');
const logger = require('../utils/logger');

// ── EXECUTOR MODUL
// Fuehrt Trades auf Kalshi und Polymarket aus
// Prueft Slippage vor Ausfuehrung
// Protokolliert jeden Trade in der Datenbank

const executor = {
  async run(markets) {
    logger.info('Executor gestartet', { markets: markets.length });

    const results = [];
    for (const market of markets) {
      if (!market.riskApproved) continue;

      try {
        const result = await this.executeTrade(market);
        if (result) results.push(result);
      } catch (error) {
        logger.error('Trade-Ausfuehrung Fehler', {
          market: market.id,
          message: error.message,
        });
      }
    }

    logger.info('Executor abgeschlossen', { executed: results.length });
    return results;
  },

  async executeTrade(market) {
    const { id, platform, title, yesPrice, consensus, signal, positionSize } = market;

    // Handelsseite bestimmen
    const side = signal === 'BUY_YES' ? 'yes' : 'no';
    const executionPrice = side === 'yes' ? yesPrice : 1 - yesPrice;

    logger.info('Trade wird ausgefuehrt', {
      market: title.substring(0, 50),
      platform,
      side,
      price: executionPrice,
      amount: Math.round(positionSize),
    });

    try {
      // Slippage-Check: Aktuellen Preis kurz vor Ausfuehrung pruefen
      const slippageOk = await this.checkSlippage(market, executionPrice);
      if (!slippageOk) {
        logger.warn('Trade abgebrochen: Zu viel Slippage', { market: id });
        return null;
      }

      // Anzahl Contracts berechnen
      // Kalshi: 1 Contract = 1 USD Gewinn
      const contracts = Math.floor(positionSize / executionPrice);
      if (contracts < 1) {
        logger.warn('Trade abgebrochen: Zu wenig Contracts', { contracts });
        return null;
      }

      let order = null;

      // Trade platzieren
      if (platform === 'kalshi') {
        order = await kalshi.placeOrder({
          tickerId: id,
          side,
          count: contracts,
          yesPrice: executionPrice,
        });
      } else if (platform === 'polymarket') {
        order = await polymarket.placeOrder({
          tokenId: market.tokenId,
          side,
          amount: positionSize,
          price: executionPrice,
        });
      }

      if (!order) {
        logger.error('Order wurde nicht bestaetigt', { market: id });
        return null;
      }

      // Trade in DB speichern
      const trade = await db.saveTrade({
        market_id:      id,
        platform,
        market_title:   title,
        side,
        amount:         positionSize,
        contracts,
        entry_price:    executionPrice,
        ai_consensus:   consensus,
        edge_pct:       market.edge,
        status:         'open',
        order_id:       order.order_id || order.id,
        created_at:     new Date().toISOString(),
      });

      logger.info('Trade erfolgreich ausgefuehrt', {
        tradeId:   trade.id,
        market:    title.substring(0, 40),
        side,
        contracts,
        amount:    Math.round(positionSize),
        price:     executionPrice,
      });

      return trade;
    } catch (error) {
      logger.error('Trade fehlgeschlagen', {
        market: id,
        platform,
        message: error.message,
      });

      // Fehlgeschlagenen Trade protokollieren
      await db.saveTrade({
        market_id:    id,
        platform,
        market_title: title,
        side,
        amount:       positionSize,
        entry_price:  executionPrice,
        status:       'failed',
        error_msg:    error.message,
        created_at:   new Date().toISOString(),
      }).catch(() => {}); // Fehler beim Logging ignorieren

      return null;
    }
  },

  // Slippage-Check: Preis hat sich nicht mehr als 2% bewegt
  async checkSlippage(market, expectedPrice) {
    try {
      let currentPrice = null;

      if (market.platform === 'kalshi') {
        const orderbook = await kalshi.getOrderbook(market.id);
        if (orderbook) {
          currentPrice = ((orderbook.yes_bid + orderbook.yes_ask) / 2) / 100;
        }
      } else if (market.platform === 'polymarket' && market.tokenId) {
        currentPrice = await polymarket.getPrice(market.tokenId);
      }

      if (!currentPrice) return true; // Wenn kein Preis: Trade erlauben

      const slippage = Math.abs(currentPrice - expectedPrice) / expectedPrice;
      if (slippage > 0.02) {
        logger.warn('Slippage zu gross', {
          expected: expectedPrice,
          current: currentPrice,
          slippage: Math.round(slippage * 100) + '%',
        });
        return false;
      }

      return true;
    } catch (error) {
      // Bei Fehler: Trade erlauben
      return true;
    }
  },

  // Offenen Trade schliessen (bei Positionsaenderung)
  async closeTrade(trade, currentPrice) {
    try {
      const pnl = (currentPrice - trade.entry_price) *
        (trade.side === 'yes' ? 1 : -1) * trade.contracts;

      await db.updateTrade(trade.id, {
        exit_price: currentPrice,
        pnl:        Math.round(pnl * 100) / 100,
        status:     'closed',
        closed_at:  new Date().toISOString(),
      });

      logger.info('Trade geschlossen', {
        tradeId: trade.id,
        pnl:     Math.round(pnl),
      });

      return pnl;
    } catch (error) {
      logger.error('Trade schliessen Fehler', { tradeId: trade.id, message: error.message });
      return 0;
    }
  },
};

module.exports = executor;
