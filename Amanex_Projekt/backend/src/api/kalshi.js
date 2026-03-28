const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// Erstellt die Authentifizierungs-Header fuer Kalshi API
function getAuthHeaders(method, path, body = '') {
  const timestamp = Date.now().toString();
  const message = timestamp + method.toUpperCase() + path + body;
  const signature = crypto
    .createHmac('sha256', config.KALSHI_API_SECRET)
    .update(message)
    .digest('base64');

  return {
    'KALSHI-ACCESS-KEY': config.KALSHI_API_KEY,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type': 'application/json',
  };
}

const kalshi = {
  // Alle aktiven Maerkte abrufen
  async getMarkets({ limit = 100, cursor = null, status = 'open' } = {}) {
    try {
      const path = '/markets';
      const params = new URLSearchParams({ limit, status });
      if (cursor) params.append('cursor', cursor);

      const response = await axios.get(`${config.KALSHI_BASE_URL}${path}?${params}`, {
        headers: getAuthHeaders('GET', path),
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      logger.error('Kalshi getMarkets Fehler', { message: error.message });
      return { markets: [], cursor: null };
    }
  },

  // Einzelnen Markt abrufen
  async getMarket(tickerId) {
    try {
      const path = `/markets/${tickerId}`;
      const response = await axios.get(`${config.KALSHI_BASE_URL}${path}`, {
        headers: getAuthHeaders('GET', path),
        timeout: 10000,
      });
      return response.data.market;
    } catch (error) {
      logger.error('Kalshi getMarket Fehler', { tickerId, message: error.message });
      return null;
    }
  },

  // Orderbook fuer einen Markt abrufen (fuer Spread-Berechnung)
  async getOrderbook(tickerId) {
    try {
      const path = `/markets/${tickerId}/orderbook`;
      const response = await axios.get(`${config.KALSHI_BASE_URL}${path}`, {
        headers: getAuthHeaders('GET', path),
        timeout: 10000,
      });
      return response.data.orderbook;
    } catch (error) {
      logger.error('Kalshi getOrderbook Fehler', { tickerId, message: error.message });
      return null;
    }
  },

  // Kontostand abrufen
  async getBalance() {
    try {
      const path = '/portfolio/balance';
      const response = await axios.get(`${config.KALSHI_BASE_URL}${path}`, {
        headers: getAuthHeaders('GET', path),
        timeout: 10000,
      });
      return response.data.balance / 100; // Kalshi gibt Cents zurueck
    } catch (error) {
      logger.error('Kalshi getBalance Fehler', { message: error.message });
      return 0;
    }
  },

  // Order platzieren
  async placeOrder({ tickerId, side, count, type = 'limit', yesPrice }) {
    try {
      const path = '/portfolio/orders';
      const body = JSON.stringify({
        ticker: tickerId,
        client_order_id: `amanex_${Date.now()}`,
        type,
        action: 'buy',
        side,           // 'yes' oder 'no'
        count,          // Anzahl Contracts
        yes_price: Math.round(yesPrice * 100), // in Cents
      });

      const response = await axios.post(`${config.KALSHI_BASE_URL}${path}`, body, {
        headers: getAuthHeaders('POST', path, body),
        timeout: 15000,
      });

      logger.info('Kalshi Order platziert', { tickerId, side, count, yesPrice });
      return response.data.order;
    } catch (error) {
      logger.error('Kalshi placeOrder Fehler', { tickerId, message: error.message });
      throw error;
    }
  },

  // Offene Orders abrufen
  async getOrders(status = 'resting') {
    try {
      const path = '/portfolio/orders';
      const response = await axios.get(`${config.KALSHI_BASE_URL}${path}?status=${status}`, {
        headers: getAuthHeaders('GET', path),
        timeout: 10000,
      });
      return response.data.orders || [];
    } catch (error) {
      logger.error('Kalshi getOrders Fehler', { message: error.message });
      return [];
    }
  },

  // Order stornieren
  async cancelOrder(orderId) {
    try {
      const path = `/portfolio/orders/${orderId}`;
      await axios.delete(`${config.KALSHI_BASE_URL}${path}`, {
        headers: getAuthHeaders('DELETE', path),
        timeout: 10000,
      });
      logger.info('Kalshi Order storniert', { orderId });
      return true;
    } catch (error) {
      logger.error('Kalshi cancelOrder Fehler', { orderId, message: error.message });
      return false;
    }
  },
};

module.exports = kalshi;
