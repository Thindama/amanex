const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

// ── INTERACTIVE BROKERS API CLIENT
// BaFin reguliert in Deutschland
// Weltweite Aktien, ETFs, Futures
// Verbindet sich mit IBKR Client Portal API (REST)

const IBKR_BASE = process.env.IBKR_BASE_URL || 'https://localhost:5000/v1/api';

const ibkr = {
  // ── MARKTDATEN

  // Aktie suchen und Contract ID finden
  async searchContract(symbol) {
    try {
      const response = await axios.get(`${IBKR_BASE}/iserver/secdef/search`, {
        params: { symbol, secType: 'STK' },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000,
      });
      return response.data[0] || null;
    } catch(error) {
      logger.error('IBKR searchContract Fehler', { symbol, message: error.message });
      return null;
    }
  },

  // Aktueller Preis via Market Data
  async getPrice(conid) {
    try {
      const response = await axios.get(`${IBKR_BASE}/iserver/marketdata/snapshot`, {
        params: { conids: conid, fields: '31,84,86' }, // 31=last, 84=bid, 86=ask
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000,
      });
      const data = response.data[0];
      return parseFloat(data['31'] || data['84'] || 0);
    } catch(error) {
      logger.error('IBKR getPrice Fehler', { conid, message: error.message });
      return null;
    }
  },

  // Portfolio und Kontostand
  async getPortfolio() {
    try {
      const accountsResp = await axios.get(`${IBKR_BASE}/portfolio/accounts`, {
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000,
      });
      const accountId = accountsResp.data[0]?.id;
      if(!accountId) return null;

      const portfolioResp = await axios.get(`${IBKR_BASE}/portfolio/${accountId}/summary`, {
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000,
      });
      return portfolioResp.data;
    } catch(error) {
      logger.error('IBKR getPortfolio Fehler', { message: error.message });
      return null;
    }
  },

  // Verfuegbares Kapital
  async getCashBalance() {
    try {
      const portfolio = await this.getPortfolio();
      return parseFloat(portfolio?.cashbalance?.amount || 0);
    } catch(error) {
      return 0;
    }
  },

  // ── TRADING

  // Order platzieren
  async placeOrder({ accountId, conid, side, quantity, orderType = 'MKT', price }) {
    try {
      const order = {
        conid,
        orderType,
        side,       // 'BUY' oder 'SELL'
        quantity,
        tif:        'DAY',
      };
      if(orderType === 'LMT' && price) order.price = price;

      const response = await axios.post(
        `${IBKR_BASE}/iserver/account/${accountId}/orders`,
        { orders: [order] },
        {
          httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
          timeout: 15000,
        }
      );

      logger.info('IBKR Order platziert', { conid, side, quantity });
      return response.data;
    } catch(error) {
      logger.error('IBKR placeOrder Fehler', { conid, message: error.message });
      throw error;
    }
  },

  // Session authentifizieren (muss regelmaessig erneuert werden)
  async tickle() {
    try {
      await axios.post(`${IBKR_BASE}/tickle`, {}, {
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 5000,
      });
      return true;
    } catch(error) {
      logger.warn('IBKR tickle Fehler', { message: error.message });
      return false;
    }
  },

  // Verbindungsstatus pruefen
  async isConnected() {
    try {
      const response = await axios.get(`${IBKR_BASE}/iserver/auth/status`, {
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 5000,
      });
      return response.data?.authenticated === true;
    } catch(error) {
      return false;
    }
  },
};

module.exports = ibkr;
