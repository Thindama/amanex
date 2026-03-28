const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const polymarket = {
  // Alle aktiven Maerkte abrufen
  async getMarkets({ limit = 100, offset = 0, active = true } = {}) {
    try {
      const response = await axios.get(`${config.POLYMARKET_GAMMA_URL}/markets`, {
        params: { limit, offset, active, closed: false, archived: false },
        timeout: 10000,
      });
      return response.data || [];
    } catch (error) {
      logger.error('Polymarket getMarkets Fehler', { message: error.message });
      return [];
    }
  },

  // Orderbook fuer einen Markt abrufen
  async getOrderbook(tokenId) {
    try {
      const response = await axios.get(`${config.POLYMARKET_CLOB_URL}/book`, {
        params: { token_id: tokenId },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      logger.error('Polymarket getOrderbook Fehler', { tokenId, message: error.message });
      return null;
    }
  },

  // Aktuellen Preis fuer einen Token abrufen
  async getPrice(tokenId) {
    try {
      const response = await axios.get(`${config.POLYMARKET_CLOB_URL}/midpoint`, {
        params: { token_id: tokenId },
        timeout: 10000,
      });
      return parseFloat(response.data.mid) || null;
    } catch (error) {
      logger.error('Polymarket getPrice Fehler', { tokenId, message: error.message });
      return null;
    }
  },

  // Order platzieren (vereinfacht - echte Implementierung braucht ethers.js Wallet)
  async placeOrder({ tokenId, side, amount, price }) {
    try {
      // Hinweis: Echte Implementierung erfordert EIP-712 Signierung mit Ethereum Wallet
      // Der Entwickler muss hier ethers.js einbinden und den Private Key verwenden
      logger.warn('Polymarket Order: Wallet-Signierung erforderlich', { tokenId, side, amount, price });

      // Platzhalter fuer echte Order-Logik
      // const wallet = new ethers.Wallet(config.POLYMARKET_PRIVATE_KEY);
      // const order = await buildOrder({ tokenId, side, amount, price });
      // const signedOrder = await wallet.signTypedData(...);
      // const response = await axios.post(`${config.POLYMARKET_CLOB_URL}/order`, signedOrder);

      throw new Error('Polymarket Order-Signierung noch nicht implementiert - Entwickler benoetigt ethers.js');
    } catch (error) {
      logger.error('Polymarket placeOrder Fehler', { tokenId, message: error.message });
      throw error;
    }
  },

  // Spread berechnen aus Orderbook
  calculateSpread(orderbook) {
    if (!orderbook || !orderbook.asks || !orderbook.bids) return 999;
    const bestAsk = parseFloat(orderbook.asks[0]?.price) || 1;
    const bestBid = parseFloat(orderbook.bids[0]?.price) || 0;
    return bestAsk - bestBid;
  },

  // Volumen aus Marktdaten extrahieren
  getVolume(market) {
    return parseFloat(market.volume) || parseFloat(market.volume24hr) || 0;
  },

  // Ablaufdatum in Tagen berechnen
  getDaysToExpiry(market) {
    if (!market.endDateIso) return 999;
    const expiry = new Date(market.endDateIso);
    const now = new Date();
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  },
};

module.exports = polymarket;
