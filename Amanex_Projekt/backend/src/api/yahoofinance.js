const axios = require('axios');
const logger = require('../utils/logger');

// ── YAHOO FINANCE CLIENT
// Kostenlos, keine API Key noetig
// Aktienpreise, News, Fundamentaldaten

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const YAHOO_BASE2 = 'https://query2.finance.yahoo.com';

const yahooFinance = {
  // Aktueller Preis und Basisdaten
  async getQuote(symbol) {
    try {
      const response = await axios.get(`${YAHOO_BASE}/v8/finance/quote`, {
        params: { symbols: symbol },
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      const result = response.data?.quoteResponse?.result?.[0];
      if(!result) return null;

      return {
        symbol:           result.symbol,
        name:             result.longName || result.shortName,
        price:            result.regularMarketPrice,
        change:           result.regularMarketChange,
        changePct:        result.regularMarketChangePercent,
        volume:           result.regularMarketVolume,
        marketCap:        result.marketCap,
        pe:               result.trailingPE,
        high52w:          result.fiftyTwoWeekHigh,
        low52w:           result.fiftyTwoWeekLow,
        avgVolume:        result.averageDailyVolume3Month,
        exchange:         result.exchange,
        currency:         result.currency,
      };
    } catch(error) {
      logger.error('Yahoo getQuote Fehler', { symbol, message: error.message });
      return null;
    }
  },

  // Mehrere Quotes auf einmal
  async getQuotes(symbols) {
    try {
      const response = await axios.get(`${YAHOO_BASE}/v8/finance/quote`, {
        params: { symbols: symbols.join(',') },
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        timeout: 10000,
      });

      const results = response.data?.quoteResponse?.result || [];
      return results.map(r => ({
        symbol:    r.symbol,
        name:      r.longName || r.shortName,
        price:     r.regularMarketPrice,
        change:    r.regularMarketChange,
        changePct: r.regularMarketChangePercent,
        volume:    r.regularMarketVolume,
        marketCap: r.marketCap,
        pe:        r.trailingPE,
      }));
    } catch(error) {
      logger.error('Yahoo getQuotes Fehler', { message: error.message });
      return [];
    }
  },

  // Historische Kursdaten (fuer technische Analyse)
  async getHistory(symbol, period = '1mo', interval = '1d') {
    try {
      const response = await axios.get(`${YAHOO_BASE}/v8/finance/chart/${symbol}`, {
        params: { period1: this.getPeriodStart(period), period2: Math.floor(Date.now()/1000), interval },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });

      const result = response.data?.chart?.result?.[0];
      if(!result) return [];

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const volumes = result.indicators?.quote?.[0]?.volume || [];

      return timestamps.map((t, i) => ({
        date:   new Date(t * 1000).toISOString().split('T')[0],
        close:  closes[i],
        volume: volumes[i],
      })).filter(d => d.close !== null);
    } catch(error) {
      logger.error('Yahoo getHistory Fehler', { symbol, message: error.message });
      return [];
    }
  },

  // News fuer ein Symbol
  async getNews(symbol) {
    try {
      const response = await axios.get(`${YAHOO_BASE2}/v1/finance/search`, {
        params: { q: symbol, newsCount: 5, quotesCount: 0 },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000,
      });

      return (response.data?.news || []).map(n => ({
        title:     n.title,
        publisher: n.publisher,
        time:      new Date(n.providerPublishTime * 1000).toISOString(),
        url:       n.link,
      }));
    } catch(error) {
      logger.error('Yahoo getNews Fehler', { symbol, message: error.message });
      return [];
    }
  },

  // RSI aus historischen Daten berechnen
  calculateRSI(history, period = 14) {
    if(history.length < period + 1) return 50;
    const closes = history.map(h => h.close).filter(Boolean);
    let gains = 0, losses = 0;
    for(let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i-1];
      if(diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = (gains/period) / ((losses/period) || 0.001);
    return 100 - (100 / (1 + rs));
  },

  getPeriodStart(period) {
    const now = Math.floor(Date.now() / 1000);
    const map = { '1d': 86400, '5d': 432000, '1mo': 2592000, '3mo': 7776000, '6mo': 15552000, '1y': 31536000 };
    return now - (map[period] || map['1mo']);
  },
};

module.exports = yahooFinance;
