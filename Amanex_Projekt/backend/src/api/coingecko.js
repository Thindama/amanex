const axios = require('axios');
const logger = require('../utils/logger');

// ── COINGECKO API CLIENT
// Kostenlos, keine API Key noetig (bis 30 Req/Min)
// Crypto Marktdaten, Trending, Sentiment

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Mapping Binance Symbol -> CoinGecko ID
const SYMBOL_MAP = {
  BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin', XRPUSDT: 'ripple', ADAUSDT: 'cardano',
  DOGEUSDT: 'dogecoin', AVAXUSDT: 'avalanche-2', DOTUSDT: 'polkadot',
  MATICUSDT: 'matic-network', LINKUSDT: 'chainlink', UNIUSDT: 'uniswap',
  ATOMUSDT: 'cosmos', LTCUSDT: 'litecoin', ETCUSDT: 'ethereum-classic',
};

const coingecko = {
  // Marktdaten fuer mehrere Coins
  async getMarketData(ids) {
    try {
      const response = await axios.get(`${COINGECKO_BASE}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: ids.join(','),
          order: 'market_cap_desc',
          per_page: 50,
          page: 1,
          sparkline: false,
          price_change_percentage: '1h,24h,7d',
        },
        timeout: 10000,
      });
      return response.data;
    } catch(error) {
      logger.error('CoinGecko getMarketData Fehler', { message: error.message });
      return [];
    }
  },

  // Trending Coins
  async getTrending() {
    try {
      const response = await axios.get(`${COINGECKO_BASE}/search/trending`, { timeout: 8000 });
      return response.data.coins?.map(c => c.item) || [];
    } catch(error) {
      logger.error('CoinGecko getTrending Fehler', { message: error.message });
      return [];
    }
  },

  // Fear & Greed Index
  async getFearGreedIndex() {
    try {
      const response = await axios.get('https://api.alternative.me/fng/', {
        params: { limit: 1 },
        timeout: 8000,
      });
      const data = response.data.data[0];
      return {
        value:       parseInt(data.value),
        label:       data.value_classification, // z.B. "Fear", "Greed", "Extreme Greed"
        timestamp:   data.timestamp,
        // Sentiment: 0-25 = Extreme Fear, 25-45 = Fear, 45-55 = Neutral, 55-75 = Greed, 75-100 = Extreme Greed
        sentiment:   parseInt(data.value) > 50 ? 'bullish' : 'bearish',
        score:       (parseInt(data.value) - 50) / 50, // -1 bis +1
      };
    } catch(error) {
      logger.error('Fear & Greed Fehler', { message: error.message });
      return { value: 50, label: 'Neutral', sentiment: 'neutral', score: 0 };
    }
  },

  // Globale Marktdaten (Total Market Cap etc.)
  async getGlobalData() {
    try {
      const response = await axios.get(`${COINGECKO_BASE}/global`, { timeout: 8000 });
      const data = response.data.data;
      return {
        totalMarketCap:   data.total_market_cap?.usd || 0,
        totalVolume:      data.total_volume?.usd || 0,
        btcDominance:     data.market_cap_percentage?.btc || 0,
        ethDominance:     data.market_cap_percentage?.eth || 0,
        marketCapChange:  data.market_cap_change_percentage_24h_usd || 0,
      };
    } catch(error) {
      logger.error('CoinGecko getGlobalData Fehler', { message: error.message });
      return null;
    }
  },

  // Symbol zu CoinGecko ID konvertieren
  getIdForSymbol(symbol) {
    return SYMBOL_MAP[symbol] || null;
  },

  // Alle IDs fuer Watchlist
  getAllIds() {
    return Object.values(SYMBOL_MAP);
  },

  // Sentiment Score aus Marktdaten berechnen
  calculateSentimentScore(marketData) {
    if(!marketData || marketData.length === 0) return 0;
    const avg24h = marketData.reduce((sum, c) => sum + (c.price_change_percentage_24h || 0), 0) / marketData.length;
    return Math.max(-1, Math.min(1, avg24h / 10)); // Normalisiert auf -1 bis +1
  },
};

module.exports = coingecko;
