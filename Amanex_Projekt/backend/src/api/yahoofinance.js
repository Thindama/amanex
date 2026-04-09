const axios = require('axios');
const logger = require('../utils/logger');

// ── YAHOO FINANCE CLIENT
// Kostenlos, keine API Key noetig
// Aktienpreise, News, Fundamentaldaten
//
// Hinweis: Yahoos /v8/finance/quote-Endpoint verlangt inzwischen Cookies + crumb-Token
// und liefert aus Datacenter-IPs fast immer HTTP 500. Wir benutzen stattdessen
// den oeffentlich erreichbaren /v8/finance/chart-Endpoint, der dieselben Kursdaten
// liefert und aus der Railway-Umgebung zuverlaessig laeuft.

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const YAHOO_BASE2 = 'https://query2.finance.yahoo.com';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Leaky-Bucket-Cache fuer Quotes, damit wir bei schnellen Aufrufen nicht
// pro Symbol einen eigenen HTTP-Call machen.
const quoteCache = new Map();
const QUOTE_CACHE_TTL_MS = 60_000;

async function fetchChartQuote(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_CACHE_TTL_MS) return cached.value;

  const response = await axios.get(`${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`, {
    params: { interval: '1d', range: '5d', includePrePost: false },
    headers: DEFAULT_HEADERS,
    timeout: 10000,
  });

  const result = response.data?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = (quote.close || []).filter(c => c !== null && c !== undefined);
  const volumes = (quote.volume || []).filter(v => v !== null && v !== undefined);

  const lastClose = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  const prevClose = meta.chartPreviousClose ?? closes[closes.length - 2] ?? lastClose;
  const change = lastClose != null && prevClose != null ? lastClose - prevClose : 0;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;

  const value = {
    symbol:    meta.symbol || symbol,
    name:      meta.longName || meta.shortName || meta.symbol || symbol,
    price:     lastClose,
    change,
    changePct,
    volume:    meta.regularMarketVolume ?? volumes[volumes.length - 1] ?? 0,
    marketCap: null,
    pe:        null,
    currency:  meta.currency || 'USD',
    exchange:  meta.exchangeName || meta.fullExchangeName || null,
  };
  quoteCache.set(symbol, { ts: Date.now(), value });
  return value;
}

const yahooFinance = {
  // Aktueller Preis und Basisdaten
  async getQuote(symbol) {
    try {
      return await fetchChartQuote(symbol);
    } catch(error) {
      logger.warn('Yahoo getQuote Fehler', { symbol, message: error.message });
      return null;
    }
  },

  // Mehrere Quotes auf einmal
  async getQuotes(symbols) {
    const list = Array.isArray(symbols) ? symbols : [];
    const settled = await Promise.allSettled(list.map(s => fetchChartQuote(s)));
    const results = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      } else if (r.status === 'rejected') {
        logger.warn('Yahoo getQuotes Symbol Fehler', { symbol: list[i], message: r.reason?.message });
      }
    }
    return results;
  },

  // Historische Kursdaten (fuer technische Analyse)
  async getHistory(symbol, period = '1mo', interval = '1d') {
    try {
      const rangeMap = { '1d': '1d', '5d': '5d', '1mo': '1mo', '3mo': '3mo', '6mo': '6mo', '1y': '1y' };
      const range = rangeMap[period] || '1mo';
      const response = await axios.get(`${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`, {
        params: { range, interval, includePrePost: false },
        headers: DEFAULT_HEADERS,
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
      })).filter(d => d.close !== null && d.close !== undefined);
    } catch(error) {
      logger.warn('Yahoo getHistory Fehler', { symbol, message: error.message });
      return [];
    }
  },

  // News fuer ein Symbol
  async getNews(symbol) {
    try {
      const response = await axios.get(`${YAHOO_BASE2}/v1/finance/search`, {
        params: { q: symbol, newsCount: 5, quotesCount: 0 },
        headers: DEFAULT_HEADERS,
        timeout: 8000,
      });

      return (response.data?.news || []).map(n => ({
        title:     n.title,
        publisher: n.publisher,
        time:      new Date(n.providerPublishTime * 1000).toISOString(),
        url:       n.link,
      }));
    } catch(error) {
      // Yahoo-News liefern aus Datacentern inzwischen oft 429/404 — Research fuellt die Luecke
      // via Google News RSS, daher keine harte Fehlermeldung.
      logger.warn('Yahoo getNews Fehler', { symbol, message: error.message });
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
