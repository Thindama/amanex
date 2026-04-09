const kraken = require('../api/kraken');
const hyperliquid = require('../api/hyperliquid');
const yahooFinance = require('../api/yahoofinance');
const coingecko = require('../api/coingecko');
const indicators = require('../indicators/localIndicators');
const { RiskManager } = require('../risk/riskManager');
const config = require('../config');
const db = require('../utils/db');
const logger = require('../utils/logger');

const STOCKS_WATCHLIST = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA',
  'TSLA','META','JPM','SAP','ASML',
  'NFLX','AMD','INTC','BA','V',
];

const HL_ASSETS = (config.HYPERLIQUID_ASSETS || 'BTC ETH SOL').split(/\s+/).filter(Boolean);
const HL_INTERVAL = config.HYPERLIQUID_INTERVAL || '5m';
// Hyperliquid-Scanner laeuft nur, wenn der Agent-Signer konfiguriert ist.
// Ohne Private-Key gaebe es bei jedem Asset einen Request-Fehler und der
// Force-Close-Check unten wuerde ebenfalls aus Ermangelung an Positionen
// sinnlos durchlaufen.
const HL_ENABLED = !!config.HYPERLIQUID_PRIVATE_KEY;

// Globale Risk-Manager-Instanz fuer Force-Close-Monitoring
const riskManager = new RiskManager();

const scanner = {
  async run() {
    logger.info('Scanner gestartet (Kraken + Hyperliquid + Aktien)');
    const startTime = Date.now();
    try {
      const [krakenResult, hyperliquidResult, stocksResult, fearGreedResult] = await Promise.allSettled([
        this.scanKraken(),
        this.scanHyperliquid(),
        this.scanStocks(),
        coingecko.getFearGreedIndex(),
      ]);
      const krakenMarkets      = krakenResult.status      === 'fulfilled' ? krakenResult.value      : [];
      const hyperliquidMarkets = hyperliquidResult.status === 'fulfilled' ? hyperliquidResult.value : [];
      const stockMarkets       = stocksResult.status      === 'fulfilled' ? stocksResult.value      : [];
      const fearGreed          = fearGreedResult.status   === 'fulfilled' ? fearGreedResult.value   : { score: 0, label: 'Neutral', value: 50 };

      // Fear/Greed-Adjustment gilt fuer alle Crypto-Schienen (Spot + Perps)
      const adjustedCrypto = [...krakenMarkets, ...hyperliquidMarkets].map(m => ({
        ...m,
        edgeScore: m.edgeScore + (m.signal === 'BUY' ? fearGreed.score * 0.1 : -fearGreed.score * 0.1),
        fearGreed: fearGreed.value,
      }));

      const allMarkets = [...adjustedCrypto, ...stockMarkets]
        .sort((a, b) => b.edgeScore - a.edgeScore)
        .slice(0, 25);

      // Scanner-Ergebnisse in DB persistieren, damit das Frontend sie ueber
      // /api/scanner/results lesen kann. Ephemere _-Felder werden entfernt.
      try {
        await db.saveMarkets(allMarkets);
      } catch (err) {
        logger.warn('Scanner DB-Persist fehlgeschlagen', { message: err.message });
      }

      // Post-scan: Force-Close Check fuer Hyperliquid-Positionen
      // (Kraken hat den Check im bestehenden Executor-Pfad).
      // Nur ausfuehren wenn Hyperliquid ueberhaupt konfiguriert ist, sonst
      // logt der Adapter bei jedem Scan unnoetig "client not initialized".
      if (HL_ENABLED) {
        try {
          const hlPositions = await hyperliquid.getOpenPositions();
          await riskManager.forceCloseIfNeeded(hlPositions, (asset) => hyperliquid.closePosition(asset));
        } catch (err) {
          logger.warn('Hyperliquid force-close check failed', { message: err.message });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info('Scanner abgeschlossen', {
        kraken: krakenMarkets.length,
        hyperliquid: hyperliquidMarkets.length,
        stocks: stockMarkets.length,
        fearGreed: fearGreed.label,
        duration: duration + 's',
      });
      return allMarkets;
    } catch(error) {
      logger.error('Scanner Fehler', { message: error.message });
      return [];
    }
  },

  async scanKraken() {
    const EUR_PAIRS = [
      {pair:'XBTEUR',title:'BTC/EUR'},{pair:'ETHEUR',title:'ETH/EUR'},
      {pair:'SOLEUR',title:'SOL/EUR'},{pair:'ADAEUR',title:'ADA/EUR'},
      {pair:'XRPEUR',title:'XRP/EUR'},{pair:'DOTEUR',title:'DOT/EUR'},
    ];
    const results = [];
    for(const {pair,title} of EUR_PAIRS) {
      try {
        const [ticker, ohlcv] = await Promise.all([kraken.getTicker(pair), kraken.getOHLCV(pair, 60)]);
        if(!ticker || !ohlcv.length || ticker.volume < 10) continue;
        const rsi = kraken.calculateRSI(ohlcv);
        let edgeScore = 0, signal = 'HOLD';
        if(rsi < 35) { edgeScore = (35-rsi)/35; signal = 'BUY'; }
        else if(rsi > 65) { edgeScore = (rsi-65)/35; signal = 'SELL'; }
        results.push({ id:pair, platform:'kraken', type:'crypto', title, price:ticker.price, change24h:Math.round(ticker.change*100)/100, volume:Math.round(ticker.volume), rsi:Math.round(rsi), edgeScore:Math.round(Math.max(0,edgeScore)*100)/100, signal, yesPrice:rsi/100, currency:'EUR' });
      } catch(e) { logger.warn('Kraken scan Fehler', {pair, message:e.message}); }
    }
    logger.info('Kraken gescannt', {count:results.length});
    return results;
  },

  async scanHyperliquid() {
    if (!HL_ENABLED) return [];
    if (!HL_ASSETS.length) return [];
    const results = [];
    for (const asset of HL_ASSETS) {
      try {
        const [klines, klines4h, price, stats] = await Promise.all([
          hyperliquid.getKlines(asset, HL_INTERVAL, 100),
          hyperliquid.getKlines(asset, '4h', 50),
          hyperliquid.getPrice(asset),
          hyperliquid.get24hStats(asset),
        ]);
        if (!klines.length || !price) continue;

        // Lokale Indikatoren (ersetzen die simplen binance-Helpers)
        const ind = indicators.computeAll(klines);
        const ind4h = indicators.computeAll(klines4h);
        const rsiVal = indicators.last(ind.rsi14) ?? 50;
        const atrVal = indicators.last(ind.atr14) ?? 0;
        const macdHist = indicators.last(ind.macd.histogram) ?? 0;

        let edgeScore = 0;
        let signal = 'HOLD';
        if (rsiVal < 35) { edgeScore = (35 - rsiVal) / 35; signal = 'BUY'; }
        else if (rsiVal > 65) { edgeScore = (rsiVal - 65) / 35; signal = 'SELL'; }

        // MACD-Histogram-Boost (bestaetigt die RSI-Direktion)
        if (signal === 'BUY' && macdHist > 0) edgeScore *= 1.15;
        if (signal === 'SELL' && macdHist < 0) edgeScore *= 1.15;

        // Volumen-Boost wie bei Binance
        const volume24h = stats?.quoteVolume || 0;
        edgeScore += Math.min(volume24h / 1e9, 0.2);

        const volatility = hyperliquid.calculateVolatility(klines);
        if (volatility > 0.02) edgeScore *= 1.2;

        const isHip3 = hyperliquid.isHip3(asset);
        const title = isHip3 ? asset.split(':')[1] : asset + '-PERP';

        results.push({
          id: asset,
          platform: 'hyperliquid',
          type: isHip3 ? 'tradfi-perp' : 'crypto-perp',
          title,
          price,
          change24h: stats ? Math.round(stats.priceChangePercent * 100) / 100 : 0,
          volume: Math.round(volume24h),
          rsi: Math.round(rsiVal),
          atr: Math.round(atrVal * 100) / 100,
          funding: stats?.funding ?? 0,
          openInterest: stats?.openInterest ?? 0,
          edgeScore: Math.round(Math.max(0, edgeScore) * 100) / 100,
          signal,
          yesPrice: rsiVal / 100,
          // Ephemere Felder (underscore) fuer downstream AI-Konsens & Executor.
          // Werden NICHT in der DB persistiert.
          _candles: klines,
          _candles4h: klines4h,
          _indicators: ind,
          _indicators4h: ind4h,
        });
      } catch (e) {
        logger.warn('Hyperliquid scan Fehler', { asset, message: e.message });
      }
    }
    logger.info('Hyperliquid gescannt', { count: results.length });
    return results;
  },

  async scanStocks() {
    try {
      const quotes = await yahooFinance.getQuotes(STOCKS_WATCHLIST);
      const results = await Promise.all(quotes.map(async (quote) => {
        try {
          const [history, news] = await Promise.all([yahooFinance.getHistory(quote.symbol,'1mo','1d'), yahooFinance.getNews(quote.symbol)]);
          const rsi = yahooFinance.calculateRSI(history);
          let edgeScore = 0, signal = 'ANALYSE';
          if(rsi < 35) { edgeScore = (35-rsi)/35; signal = 'BUY'; }
          else if(rsi > 65) { edgeScore = (rsi-65)/35; signal = 'SELL'; }
          const posNews = news.filter(n => /beat|surge|record|growth|profit|strong/i.test(n.title)).length;
          const negNews = news.filter(n => /miss|fall|drop|loss|weak|cut/i.test(n.title)).length;
          edgeScore += ((posNews - negNews) / (news.length || 1)) * 0.1;
          return { id:quote.symbol, platform:'stocks', type:'stock', title:quote.name+' ('+quote.symbol+')', price:quote.price, change24h:Math.round((quote.changePct||0)*100)/100, volume:quote.volume, rsi:Math.round(rsi), pe:quote.pe, edgeScore:Math.round(Math.max(0,edgeScore)*100)/100, signal, yesPrice:rsi/100, note:'Manuell via Trade Republic / Scalable Capital' };
        } catch(e) { return null; }
      }));
      const valid = results.filter(Boolean);
      logger.info('Aktien gescannt', {count:valid.length});
      return valid;
    } catch(error) {
      logger.error('Aktien scan Fehler', {message:error.message});
      return [];
    }
  },
};

module.exports = scanner;
