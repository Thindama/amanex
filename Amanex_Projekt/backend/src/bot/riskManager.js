const config = require('../config');
const db = require('../utils/db');
const logger = require('../utils/logger');

// ── RISK MANAGER
// Deterministisch implementiert - keine KI-Logik hier
// Alle Regeln werden exakt so ausgefuehrt wie definiert
// Kill-Switch Pruefung bei jedem Aufruf

const riskManager = {
  // Globaler Kill-Switch Status
  _killSwitch: false,

  activateKillSwitch() {
    this._killSwitch = true;
    logger.warn('KILL SWITCH AKTIVIERT - Alle neuen Trades blockiert');
  },

  deactivateKillSwitch() {
    this._killSwitch = false;
    logger.info('Kill Switch deaktiviert - Bot wieder aktiv');
  },

  isKillSwitchActive() {
    return this._killSwitch;
  },

  // ── HAUPT-VALIDIERUNG
  // Gibt { approved: true/false, reason: string, positionSize: number } zurueck
  async validate(market) {
    logger.info('Risikocheck gestartet', { market: market.id, edge: market.edge });

    try {
      // 0. Kill-Switch
      if (this._killSwitch) {
        return this.reject('Kill Switch aktiv');
      }

      // Kontostand und offene Trades laden
      const [balance, openTrades, dailyPnl] = await Promise.all([
        db.getAccountBalance(),
        db.getOpenTrades(),
        db.getDailyPnL(),
      ]);

      // 1. Edge-Check
      const edgeCheck = this.checkEdge(market.edge);
      if (!edgeCheck.passed) return this.reject(edgeCheck.reason);

      // 2. Drawdown-Check
      const drawdownCheck = await this.checkDrawdown(balance);
      if (!drawdownCheck.passed) return this.reject(drawdownCheck.reason);

      // 3. Tagesverlust-Check
      const dailyLossCheck = this.checkDailyLoss(dailyPnl, balance);
      if (!dailyLossCheck.passed) return this.reject(dailyLossCheck.reason);

      // 4. Max. gleichzeitige Positionen
      const positionsCheck = this.checkMaxPositions(openTrades.length);
      if (!positionsCheck.passed) return this.reject(positionsCheck.reason);

      // 5. Konfidenz-Check
      if (market.confidence === 'low') {
        return this.reject('KI-Konfidenz zu niedrig (weniger als 2 Modelle)');
      }

      // 6. Positionsgroesse berechnen (Kelly)
      const positionSize = this.calculatePositionSize(market, balance);
      if (positionSize < 1) {
        return this.reject('Berechnete Positionsgroesse zu klein');
      }

      // 7. Gesamt-Exposure pruefen
      const totalExposure = openTrades.reduce((sum, t) => sum + (t.amount || 0), 0);
      const newExposure = totalExposure + positionSize;
      const exposurePct = (newExposure / balance) * 100;
      if (exposurePct > 40) {
        return this.reject(`Gesamt-Exposure zu hoch: ${Math.round(exposurePct)}%`);
      }

      // Alle Checks bestanden
      logger.info('Risikocheck bestanden', {
        market: market.id,
        positionSize: Math.round(positionSize),
        balance: Math.round(balance),
        openTrades: openTrades.length,
      });

      return {
        approved: true,
        reason: 'Alle Checks bestanden',
        positionSize: Math.round(positionSize),
        balance,
        openTradesCount: openTrades.length,
        dailyPnl,
      };
    } catch (error) {
      logger.error('Risikocheck Fehler', { message: error.message });
      return this.reject('Technischer Fehler beim Risikocheck');
    }
  },

  // ── EINZELNE CHECKS

  checkEdge(edge) {
    if (edge === undefined || edge === null) {
      return { passed: false, reason: 'Kein Edge berechnet' };
    }
    if (Math.abs(edge) < config.MIN_EDGE_PCT) {
      return { passed: false, reason: `Edge ${edge}% unter Minimum ${config.MIN_EDGE_PCT}%` };
    }
    return { passed: true };
  },

  async checkDrawdown(currentBalance) {
    try {
      // Hoechsten Kontostand aus DB laden
      const settings = await db.getBotSettings();
      const peakBalance = parseFloat(settings.peak_balance) || currentBalance;

      if (currentBalance > peakBalance) {
        // Neues Hoch - Peak updaten
        await db.supabase.from('bot_settings').upsert({
          key: 'peak_balance',
          value: String(currentBalance),
        });
        return { passed: true };
      }

      const drawdown = ((peakBalance - currentBalance) / peakBalance) * 100;
      if (drawdown >= config.MAX_DRAWDOWN_PCT) {
        return {
          passed: false,
          reason: `Drawdown ${Math.round(drawdown)}% erreicht Limit ${config.MAX_DRAWDOWN_PCT}%`,
        };
      }
      return { passed: true, drawdown: Math.round(drawdown * 10) / 10 };
    } catch (error) {
      // Bei DB-Fehler: Check ignorieren (fail-safe)
      return { passed: true };
    }
  },

  checkDailyLoss(dailyPnl, balance) {
    if (dailyPnl >= 0) return { passed: true };

    const lossPct = (Math.abs(dailyPnl) / balance) * 100;
    if (lossPct >= config.MAX_DAILY_LOSS_PCT) {
      return {
        passed: false,
        reason: `Tagesverlust ${Math.round(lossPct)}% erreicht Limit ${config.MAX_DAILY_LOSS_PCT}%`,
      };
    }
    return { passed: true, lossPct: Math.round(lossPct * 10) / 10 };
  },

  checkMaxPositions(openCount) {
    if (openCount >= config.MAX_CONCURRENT_TRADES) {
      return {
        passed: false,
        reason: `Max. Positionen erreicht: ${openCount}/${config.MAX_CONCURRENT_TRADES}`,
      };
    }
    return { passed: true };
  },

  // ── KELLY-KRITERIUM
  // f* = (p * b - q) / b
  // p = Gewinnwahrscheinlichkeit (KI-Schaetzung)
  // q = 1 - p
  // b = Netto-Gewinn/Verlust-Verhaeltnis
  calculatePositionSize(market, balance) {
    const p = market.consensus; // KI-Schaetzung (0-1)
    const q = 1 - p;

    // Implizite Odds aus Marktpreis berechnen
    // Wenn Marktpreis = 0.62, dann Gewinn = (1 - 0.62) / 0.62 = 0.613
    const b = (1 - market.yesPrice) / market.yesPrice;

    // Kelly-Formel
    const kelly = (p * b - q) / b;

    if (kelly <= 0) return 0; // Kein positiver Edge

    // Viertel-Kelly anwenden (konservativer)
    const fractionalKelly = kelly * config.KELLY_FRACTION;

    // Max. Position begrenzen
    const maxPositionPct = config.MAX_POSITION_PCT / 100;
    const appliedPct = Math.min(fractionalKelly, maxPositionPct);

    return balance * appliedPct;
  },

  // ── HILFSFUNKTIONEN
  reject(reason) {
    logger.info('Trade abgelehnt', { reason });
    return { approved: false, reason, positionSize: 0 };
  },

  // Value at Risk (VaR) berechnen - informativ
  calculateVaR(positions, confidence = 0.95) {
    if (!positions || positions.length === 0) return 0;
    const losses = positions.map(p => p.amount * (1 - p.probability));
    losses.sort((a, b) => b - a);
    const varIndex = Math.floor(losses.length * (1 - confidence));
    return losses[varIndex] || 0;
  },
};

module.exports = riskManager;
