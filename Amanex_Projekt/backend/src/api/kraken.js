const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// ── KRAKEN API CLIENT
// EU-reguliert, BaFin lizenziert
// Ideal fuer EUR-Paare (BTCEUR, ETHEUR etc.)

const KRAKEN_BASE = 'https://api.kraken.com';

function getKrakenSignature(path, nonce, postData) {
  const message = postData + crypto.createHash('sha256').update(nonce + postData).digest('binary');
  return crypto.createHmac('sha512', Buffer.from(config.KRAKEN_API_SECRET || '', 'base64'))
    .update(path + message, 'binary')
    .digest('base64');
}

const kraken = {
  // ── MARKTDATEN (kein Key noetig)

  async getTicker(pair) {
    try {
      const response = await axios.get(`${KRAKEN_BASE}/0/public/Ticker`, {
        params: { pair },
        timeout: 8000,
      });
      const result = response.data.result;
      const key = Object.keys(result)[0];
      const data = result[key];
      const close = parseFloat(data.c[0]);
      const open = parseFloat(data.o);
      // Kraken's data.p[1] ist VWAP der letzten 24h, kein Prozent-Change.
      // Echter 24h-Change = (close - open) / open * 100
      const changePct = open > 0 ? ((close - open) / open) * 100 : 0;
      return {
        price:    close,
        volume:   parseFloat(data.v[1]),
        high:     parseFloat(data.h[1]),
        low:      parseFloat(data.l[1]),
        open,
        vwap24h:  parseFloat(data.p[1]),
        change:   changePct,
      };
    } catch(error) {
      logger.error('Kraken getTicker Fehler', { pair, message: error.message });
      return null;
    }
  },

  async getTopPairs() {
    const EUR_PAIRS = [
      'XBTEUR','ETHEUR','SOLEUR','ADAEUR','XRPEUR',
      'DOTEUR','LINKEUR','UNIEUR','ATOMEUR','LTCEUR',
    ];
    const results = [];
    for(const pair of EUR_PAIRS) {
      const ticker = await this.getTicker(pair);
      if(ticker && ticker.volume > 100) {
        results.push({ symbol: pair, platform: 'kraken', ...ticker });
      }
    }
    return results;
  },

  async getOHLCV(pair, interval = 60) {
    try {
      const response = await axios.get(`${KRAKEN_BASE}/0/public/OHLC`, {
        params: { pair, interval },
        timeout: 10000,
      });
      const result = response.data.result;
      const key = Object.keys(result).find(k => k !== 'last');
      return (result[key] || []).map(k => ({
        time:   k[0],
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[6]),
      }));
    } catch(error) {
      logger.error('Kraken getOHLCV Fehler', { pair, message: error.message });
      return [];
    }
  },

  // ── ACCOUNT (API Key noetig)

  async getBalance() {
    try {
      const nonce = Date.now().toString();
      const postData = 'nonce=' + nonce;
      const path = '/0/private/Balance';
      const signature = getKrakenSignature(path, nonce, postData);

      const response = await axios.post(`${KRAKEN_BASE}${path}`, postData, {
        headers: {
          'API-Key':  config.KRAKEN_API_KEY || '',
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      return response.data.result || {};
    } catch(error) {
      logger.error('Kraken getBalance Fehler', { message: error.message });
      return {};
    }
  },

  async getEURBalance() {
    const balances = await this.getBalance();
    return parseFloat(balances.ZEUR || balances.EUR || 0);
  },

  // ── TRADING

  async placeOrder({ pair, type, ordertype = 'market', volume }) {
    try {
      const nonce = Date.now().toString();
      const postData = `nonce=${nonce}&pair=${pair}&type=${type}&ordertype=${ordertype}&volume=${volume.toFixed(6)}`;
      const path = '/0/private/AddOrder';
      const signature = getKrakenSignature(path, nonce, postData);

      const response = await axios.post(`${KRAKEN_BASE}${path}`, postData, {
        headers: {
          'API-Key':  config.KRAKEN_API_KEY || '',
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      });

      logger.info('Kraken Order platziert', { pair, type, volume });
      return response.data.result;
    } catch(error) {
      logger.error('Kraken placeOrder Fehler', { pair, message: error.message });
      throw error;
    }
  },

  // RSI berechnen
  calculateRSI(ohlcv, period = 14) {
    if(ohlcv.length < period + 1) return 50;
    const closes = ohlcv.map(k => k.close);
    let gains = 0, losses = 0;
    for(let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i-1];
      if(diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = (gains/period) / ((losses/period) || 0.001);
    return 100 - (100 / (1 + rs));
  },
};

module.exports = kraken;
