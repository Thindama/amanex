const kalshi = require('../api/kalshi');
const polymarket = require('../api/polymarket');
const config = require('../config');
const logger = require('../utils/logger');

// ── SCANNER
// Scannt alle Maerkte auf Kalshi und Polymarket
// Filtert nach Liquiditaet, Volumen und Ablaufzeit
// Gibt eine sortierte Liste der besten Chancen zurueck

const scanner = {
  async run() {
    logger.info('Scanner gestartet');
    const startTime = Date.now();

    try {
      // Beide Plattformen parallel scannen
      const [kalshiMarkets, polyMarkets] = await Promise.allSettled([
        this.scanKalshi(),
        this.scanPolymarket(),
      ]);

      const kalshiResults = kalshiMarkets.status === 'fulfilled' ? kalshiMarkets.value : [];
      const polyResults   = polyMarkets.status === 'fulfilled'   ? polyMarkets.value : [];

      // Alle Maerkte zusammenfuehren
      const allMarkets = [...kalshiResults, ...polyResults];

      // Nach Edge-Score sortieren (beste zuerst)
      allMarkets.sort((a, b) => b.edgeScore - a.edgeScore);

      // Top 20 zurueckgeben
      const topMarkets = allMarkets.slice(0, 20);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info('Scanner abgeschlossen', {
        kalshi: kalshiResults.length,
        polymarket: polyResults.length,
        top: topMarkets.length,
        duration: duration + 's',
      });

      return topMarkets;
    } catch (error) {
      logger.error('Scanner Fehler', { message: error.message });
      return [];
    }
  },

  // ── KALSHI SCANNER
  async scanKalshi() {
    const results = [];
    let cursor = null;
    let page = 0;
    const maxPages = 5; // Max. 500 Maerkte scannen

    while (page < maxPages) {
      const { markets, cursor: nextCursor } = await kalshi.getMarkets({
        limit: 100,
        cursor,
        status: 'open',
      });

      if (!markets || markets.length === 0) break;

      for (const market of markets) {
        const filtered = await this.filterKalshiMarket(market);
        if (filtered) results.push(filtered);
      }

      if (!nextCursor) break;
      cursor = nextCursor;
      page++;
    }

    logger.info('Kalshi gescannt', { total: results.length });
    return results;
  },

  async filterKalshiMarket(market) {
    try {
      // Grundfilter
      if (market.status !== 'open') return null;

      // Volumen pruefen
      const volume = market.volume || 0;
      if (volume < config.MIN_VOLUME) return null;

      // Ablaufzeit pruefen
      const daysToExpiry = this.getDaysToExpiry(market.close_time);
      if (daysToExpiry > config.MAX_EXPIRY_DAYS || daysToExpiry < 0) return null;

      // Aktueller Preis (Yes-Preis in Prozent)
      const yesPrice = (market.yes_bid + market.yes_ask) / 2 / 100; // Cents -> Dezimal
      if (yesPrice <= 0 || yesPrice >= 1) return null;

      // Spread pruefen (max. 5 Cent)
      const spread = (market.yes_ask - market.yes_bid) / 100;
      if (spread > 0.05) return null;

      // Edge-Score berechnen (fuer Sortierung - echter Edge kommt vom Prediction-Modul)
      const liquidityScore  = Math.min(volume / 10000, 1);
      const timeScore       = 1 - (daysToExpiry / config.MAX_EXPIRY_DAYS);
      const spreadScore     = 1 - (spread / 0.05);
      const edgeScore       = (liquidityScore * 0.4) + (timeScore * 0.3) + (spreadScore * 0.3);

      return {
        id:           market.ticker_name,
        platform:     'kalshi',
        title:        market.title || market.ticker_name,
        yesPrice:     Math.round(yesPrice * 100) / 100,
        volume:       Math.round(volume),
        daysToExpiry: Math.round(daysToExpiry),
        spread:       Math.round(spread * 100) / 100,
        edgeScore:    Math.round(edgeScore * 100) / 100,
        raw:          market,
      };
    } catch (error) {
      return null;
    }
  },

  // ── POLYMARKET SCANNER
  async scanPolymarket() {
    const results = [];
    const markets = await polymarket.getMarkets({ limit: 100, active: true });

    for (const market of markets) {
      const filtered = this.filterPolymarket(market);
      if (filtered) results.push(filtered);
    }

    logger.info('Polymarket gescannt', { total: results.length });
    return results;
  },

  filterPolymarket(market) {
    try {
      // Nur aktive, nicht archivierte Maerkte
      if (!market.active || market.archived || market.closed) return null;

      // Volumen pruefen
      const volume = polymarket.getVolume(market);
      if (volume < config.MIN_VOLUME) return null;

      // Ablaufzeit pruefen
      const daysToExpiry = polymarket.getDaysToExpiry(market);
      if (daysToExpiry > config.MAX_EXPIRY_DAYS || daysToExpiry < 0) return null;

      // Preis aus outcomes extrahieren
      const outcomes = market.outcomes || [];
      if (outcomes.length < 2) return null;

      const yesPriceStr = market.outcomePrices?.[0] || '0.5';
      const yesPrice    = parseFloat(yesPriceStr);
      if (yesPrice <= 0 || yesPrice >= 1) return null;

      // Edge-Score
      const liquidityScore  = Math.min(volume / 10000, 1);
      const timeScore       = 1 - (daysToExpiry / config.MAX_EXPIRY_DAYS);
      const edgeScore       = (liquidityScore * 0.5) + (timeScore * 0.5);

      return {
        id:           market.conditionId || market.id,
        platform:     'polymarket',
        title:        market.question || market.title,
        yesPrice:     Math.round(yesPrice * 100) / 100,
        volume:       Math.round(volume),
        daysToExpiry: Math.round(daysToExpiry),
        spread:       0.02, // Polymarket hat typischerweise enge Spreads
        edgeScore:    Math.round(edgeScore * 100) / 100,
        tokenId:      market.tokens?.[0]?.token_id,
        raw:          market,
      };
    } catch (error) {
      return null;
    }
  },

  // ── HILFSFUNKTIONEN
  getDaysToExpiry(closeTimeStr) {
    if (!closeTimeStr) return 999;
    const closeTime = new Date(closeTimeStr);
    const now       = new Date();
    return (closeTime - now) / (1000 * 60 * 60 * 24);
  },

  // Preisbewegung pruefen (Anomalie-Erkennung)
  isPriceAnomaly(currentPrice, historicalPrices = []) {
    if (historicalPrices.length < 3) return false;
    const avg = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
    const change = Math.abs(currentPrice - avg) / avg;
    return change > 0.10; // Mehr als 10% Abweichung vom Durchschnitt
  },
};

module.exports = scanner;
