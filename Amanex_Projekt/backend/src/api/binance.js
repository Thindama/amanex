const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// ── BINANCE API CLIENT
// Offiziell regulierte Crypto-Boerse
// REST API fuer Spot Trading (BTC, ETH, SOL, etc.)

const BINANCE_BASE = 'https://api.binance.com';

function sign(queryString) {
  return crypto
    .createHmac('sha256', config.BINANCE_API_SECRET || '')
    .update(queryString)
    .digest('hex');
}

function getHeaders() {
  return { 'X-MBX-APIKEY': config.BINANCE_API_KEY || '' };
}

const binance = {
  // ── MARKTDATEN (kein API Key noetig)

  // Alle verfuegbaren Trading-Paare abrufen
  async getExchangeInfo() {
    try {
      const response = await axios.get(`${BINANCE_BASE}/api/v3/exchangeInfo`, { timeout: 10000 });
      return response.data;
    } catch (error) {
      logger.error('Binance getExchangeInfo Fehler', { message: error.message });
      return null;
    }
  },

  // Aktueller Preis fuer ein Symbol
  async getPrice(symbol) {
    try {
      const response = await axios.get(`${BINANCE_BASE}/api/v3/ticker/price`, {
        params: { symbol },
        timeout: 8000,
      });
      return parseFloat(response.data.price);
    } catch (error) {
      logger.error('Binance getPrice Fehler', { symbol, message: error.message });
      return null;
    }
  },

  // 24h Statistiken (Volumen, Preisaenderung etc.)
  async get24hStats(symbol) {
    try {
      const response = await axios.get(`${BINANCE_BASE}/api/v3/ticker/24hr`, {
        params: { symbol },
        timeout: 8000,
      });
      return response.data;
    } catch (error) {
      logger.error('Binance get24hStats Fehler', { symbol, message: error.message });
      return null;
    }
  },

  // Alle Top-Paare nach Volumen abrufen (fuer Scanner)
  async getTopPairs(limit = 20) {
    try {
      const response = await axios.get(`${BINANCE_BASE}/api/v3/ticker/24hr`, { timeout: 10000 });
      const pairs = response.data
        .filter(p => p.symbol.endsWith('USDT') && parseFloat(p.quoteVolume) > 1000000)
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit);
      return pairs;
    } catch (error) {
      logger.error('Binance getTopPairs Fehler', { message: error.message });
      return [];
    }
  },

  // Kerzendaten (OHLCV) fuer technische Analyse
  async getKlines(symbol, interval = '1h', limit = 100) {
    try {
      const response = await axios.get(`${BINANCE_BASE}/api/v3/klines`, {
        params: { symbol, interval, limit },
        timeout: 10000,
      });
      return response.data.map(k => ({
        openTime:  k[0],
        open:      parseFloat(k[1]),
        high:      parseFloat(k[2]),
        low:       parseFloat(k[3]),
        close:     parseFloat(k[4]),
        volume:    parseFloat(k[5]),
        closeTime: k[6],
      }));
    } catch (error) {
      logger.error('Binance getKlines Fehler', { symbol, message: error.message });
      return [];
    }
  },

  // Order Book (fuer Liquiditaetscheck)
  async getOrderBook(symbol, limit = 10) {
    try {
      const response = await axios.get(`${BINANCE_BASE}/api/v3/depth`, {
        params: { symbol, limit },
        timeout: 8000,
      });
      return response.data;
    } catch (error) {
      logger.error('Binance getOrderBook Fehler', { symbol, message: error.message });
      return null;
    }
  },

  // ── ACCOUNT (API Key benoetigt)

  // Kontostand abrufen
  async getBalance() {
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = sign(queryString);

      const response = await axios.get(`${BINANCE_BASE}/api/v3/account`, {
        params: { timestamp, signature },
        headers: getHeaders(),
        timeout: 10000,
      });

      // Alle Balances mit Wert > 0
      const balances = response.data.balances
        .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .reduce((acc, b) => {
          acc[b.asset] = {
            free:   parseFloat(b.free),
            locked: parseFloat(b.locked),
          };
          return acc;
        }, {});

      return balances;
    } catch (error) {
      logger.error('Binance getBalance Fehler', { message: error.message });
      return {};
    }
  },

  // USDT Balance (Hauptwaehrung fuer Trading)
  async getUSDTBalance() {
    const balances = await this.getBalance();
    return balances.USDT?.free || 0;
  },

  // ── TRADING (API Key + Secret benoetigt)

  // Market Order platzieren
  async placeMarketOrder({ symbol, side, quantity }) {
    try {
      const timestamp = Date.now();
      const params = {
        symbol,
        side,        // 'BUY' oder 'SELL'
        type:        'MARKET',
        quantity:    quantity.toFixed(6),
        timestamp,
      };

      const queryString = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      const signature = sign(queryString);

      const response = await axios.post(
        `${BINANCE_BASE}/api/v3/order`,
        `${queryString}&signature=${signature}`,
        {
          headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        }
      );

      logger.info('Binance Order platziert', {
        symbol, side, quantity,
        orderId: response.data.orderId,
        status:  response.data.status,
      });

      return response.data;
    } catch (error) {
      logger.error('Binance placeMarketOrder Fehler', { symbol, side, message: error.message });
      throw error;
    }
  },

  // Limit Order platzieren
  async placeLimitOrder({ symbol, side, quantity, price }) {
    try {
      const timestamp = Date.now();
      const params = {
        symbol,
        side,
        type:        'LIMIT',
        timeInForce: 'GTC',
        quantity:    quantity.toFixed(6),
        price:       price.toFixed(2),
        timestamp,
      };

      const queryString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
      const signature = sign(queryString);

      const response = await axios.post(
        `${BINANCE_BASE}/api/v3/order`,
        `${queryString}&signature=${signature}`,
        {
          headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        }
      );

      logger.info('Binance Limit Order platziert', { symbol, side, quantity, price });
      return response.data;
    } catch (error) {
      logger.error('Binance placeLimitOrder Fehler', { symbol, message: error.message });
      throw error;
    }
  },

  // Order stornieren
  async cancelOrder(symbol, orderId) {
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
      const signature = sign(queryString);

      await axios.delete(`${BINANCE_BASE}/api/v3/order?${queryString}&signature=${signature}`, {
        headers: getHeaders(),
        timeout: 10000,
      });

      logger.info('Binance Order storniert', { symbol, orderId });
      return true;
    } catch (error) {
      logger.error('Binance cancelOrder Fehler', { symbol, orderId, message: error.message });
      return false;
    }
  },

  // Offene Orders abrufen
  async getOpenOrders(symbol) {
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&timestamp=${timestamp}`;
      const signature = sign(queryString);

      const response = await axios.get(
        `${BINANCE_BASE}/api/v3/openOrders?${queryString}&signature=${signature}`,
        { headers: getHeaders(), timeout: 10000 }
      );

      return response.data;
    } catch (error) {
      logger.error('Binance getOpenOrders Fehler', { symbol, message: error.message });
      return [];
    }
  },

  // ── HILFSFUNKTIONEN

  // Volatilitaet berechnen (fuer Edge-Berechnung)
  calculateVolatility(klines) {
    if (!klines || klines.length < 2) return 0;
    const returns = klines.slice(1).map((k, i) => (k.close - klines[i].close) / klines[i].close);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  },

  // RSI berechnen (Technischer Indikator)
  calculateRSI(klines, period = 14) {
    if (klines.length < period + 1) return 50;
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
    return 100 - (100 / (1 + rs));
  },

  // Symbol normalisieren (BTC -> BTCUSDT)
  toSymbol(asset) {
    if (asset.endsWith('USDT')) return asset;
    return asset + 'USDT';
  },
};

module.exports = binance;
