const db = require('../utils/db');
const logger = require('../utils/logger');

// ── LEARNER MODUL
// Analysiert jeden abgeschlossenen Trade
// Klassifiziert Fehler und speichert Lektionen
// Verbessert zukuenftige Prognosen durch Wissensbasis

const FAILURE_TYPES = {
  BAD_PREDICTION: 'bad_prediction',  // KI-Prognose war falsch
  BAD_TIMING:     'bad_timing',      // Richtiger Trend, falscher Zeitpunkt
  EXTERNAL_SHOCK: 'external_shock',  // Unvorhersehbares Ereignis
  EXECUTION:      'execution',       // Technisches Ausfuehrungsproblem
};

const learner = {
  async run() {
    logger.info('Learner gestartet');

    try {
      // Alle noch nicht analysierten geschlossenen Trades laden
      const { data: trades, error } = await db.supabase
        .from('trades')
        .select('*')
        .eq('status', 'closed')
        .eq('analyzed', false)
        .order('closed_at', { ascending: true })
        .limit(50);

      if (error || !trades || trades.length === 0) {
        logger.info('Keine neuen Trades zum Analysieren');
        return;
      }

      logger.info('Trades werden analysiert', { count: trades.length });

      for (const trade of trades) {
        await this.analyzeTrade(trade);
      }

      // Performance-Metriken berechnen und speichern
      await this.updatePerformanceMetrics();

      logger.info('Learner abgeschlossen', { analyzed: trades.length });
    } catch (error) {
      logger.error('Learner Fehler', { message: error.message });
    }
  },

  async analyzeTrade(trade) {
    try {
      const won = trade.pnl > 0;
      const aiWasRight = (trade.side === 'yes' && won) || (trade.side === 'no' && !won);

      // Als analysiert markieren
      await db.updateTrade(trade.id, { analyzed: true });

      // Gewonnene Trades kurz protokollieren
      if (won) {
        logger.info('Trade gewonnen', {
          tradeId: trade.id,
          market: (trade.market_title || '').substring(0, 40),
          pnl: Math.round(trade.pnl),
        });
        return;
      }

      // Verlorene Trades ausfuehrlich analysieren
      logger.info('Verlorenen Trade analysieren', {
        tradeId: trade.id,
        market: (trade.market_title || '').substring(0, 40),
        pnl: Math.round(trade.pnl),
      });

      const failureType   = this.classifyFailure(trade, aiWasRight);
      const lesson        = this.generateLesson(trade, failureType);
      const marketCategory = this.categorizeMarket(trade.market_title || '');

      // Lektion in Wissensbasis speichern
      await db.saveLesson({
        trade_id:        trade.id,
        market_id:       trade.market_id,
        platform:        trade.platform,
        failure_type:    failureType,
        market_category: marketCategory,
        lesson,
        entry_price:     trade.entry_price,
        ai_consensus:    trade.ai_consensus,
        edge_pct:        trade.edge_pct,
        pnl:             trade.pnl,
        created_at:      new Date().toISOString(),
      });

      logger.info('Lektion gespeichert', {
        type:     failureType,
        category: marketCategory,
        lesson:   lesson.substring(0, 80),
      });
    } catch (error) {
      logger.error('Trade-Analyse Fehler', { tradeId: trade.id, message: error.message });
    }
  },

  // Fehlertyp klassifizieren
  classifyFailure(trade, aiWasRight) {
    // KI-Prognose war falsch (schlechteste Art von Fehler)
    if (!aiWasRight && trade.edge_pct >= 8) {
      return FAILURE_TYPES.BAD_PREDICTION;
    }

    // Edge war knapp (moegliches Timing-Problem)
    if (trade.edge_pct < 6) {
      return FAILURE_TYPES.BAD_TIMING;
    }

    // Hoher Verlust trotz guter KI-Prognose
    if (aiWasRight && trade.pnl < -(trade.amount * 0.5)) {
      return FAILURE_TYPES.EXTERNAL_SHOCK;
    }

    // Standard: Schlechte Prognose
    return FAILURE_TYPES.BAD_PREDICTION;
  },

  // Lektion formulieren
  generateLesson(trade, failureType) {
    const category = this.categorizeMarket(trade.market_title || '');
    const platform  = trade.platform;
    const edgePct   = trade.edge_pct;

    const lessons = {
      [FAILURE_TYPES.BAD_PREDICTION]: [
        `${category}-Maerkte auf ${platform}: KI-Prognose bei Edge ${edgePct}% war falsch. Mindest-Edge erhoehen oder Modell-Gewichtung anpassen.`,
        `Zukuenftig bei ${category}-Maerkten auf ${platform} mehr Quellen pruefen bevor gehandelt wird.`,
      ],
      [FAILURE_TYPES.BAD_TIMING]: [
        `${category}-Markt: Zu frueh eingestiegen (Edge ${edgePct}%). Auf staerkeres Signal warten.`,
        `Min-Edge fuer ${category}-Maerkte auf ${edgePct + 2}% erhoehen.`,
      ],
      [FAILURE_TYPES.EXTERNAL_SHOCK]: [
        `Unerwartetes Ereignis bei ${category}-Markt auf ${platform}. Stop-Loss-Mechanismus pruefen.`,
        `${category}-Maerkte sind anfaellig fuer externe Schocks. Positionsgroesse reduzieren.`,
      ],
      [FAILURE_TYPES.EXECUTION]: [
        `Technisches Problem bei Trade-Ausfuehrung auf ${platform}. Slippage-Check anpassen.`,
      ],
    };

    const options = lessons[failureType] || lessons[FAILURE_TYPES.BAD_PREDICTION];
    return options[Math.floor(Math.random() * options.length)];
  },

  // Marktkategorie bestimmen
  categorizeMarket(title) {
    const t = title.toLowerCase();
    if (t.includes('fed') || t.includes('ezb') || t.includes('rate') || t.includes('zins')) return 'Zentralbank';
    if (t.includes('btc') || t.includes('bitcoin') || t.includes('eth') || t.includes('crypto')) return 'Krypto';
    if (t.includes('election') || t.includes('wahl') || t.includes('president')) return 'Politik';
    if (t.includes('earnings') || t.includes('apple') || t.includes('google') || t.includes('q2') || t.includes('q4')) return 'Unternehmen';
    if (t.includes('inflation') || t.includes('gdp') || t.includes('unemployment') || t.includes('arbeit')) return 'Wirtschaft';
    return 'Sonstige';
  },

  // Performance-Metriken berechnen und in DB speichern
  async updatePerformanceMetrics() {
    try {
      const { data: trades } = await db.supabase
        .from('trades')
        .select('pnl, ai_consensus, status')
        .eq('status', 'closed')
        .limit(500);

      if (!trades || trades.length === 0) return;

      const won       = trades.filter(t => t.pnl > 0).length;
      const winRate   = Math.round((won / trades.length) * 1000) / 10;
      const totalPnl  = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
      const grossLoss   = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : null;

      // Brier Score
      const withConsensus = trades.filter(t => t.ai_consensus !== null);
      let brierScore = null;
      if (withConsensus.length > 0) {
        const sum = withConsensus.reduce((acc, t) => {
          const outcome = t.pnl > 0 ? 1 : 0;
          return acc + Math.pow(t.ai_consensus - outcome, 2);
        }, 0);
        brierScore = Math.round((sum / withConsensus.length) * 1000) / 1000;
      }

      // In DB speichern
      const metrics = [
        { key: 'win_rate', value: String(winRate) },
        { key: 'total_pnl', value: String(Math.round(totalPnl)) },
        { key: 'total_trades', value: String(trades.length) },
        { key: 'profit_factor', value: String(profitFactor) },
        { key: 'brier_score', value: String(brierScore) },
        { key: 'metrics_updated_at', value: new Date().toISOString() },
      ];

      for (const metric of metrics) {
        await db.supabase.from('bot_settings').upsert(metric);
      }

      logger.info('Performance-Metriken aktualisiert', {
        winRate:      winRate + '%',
        totalPnl:     Math.round(totalPnl),
        profitFactor,
        brierScore,
        trades:       trades.length,
      });
    } catch (error) {
      logger.error('Metriken-Update Fehler', { message: error.message });
    }
  },
};

module.exports = learner;
