const cron = require('node-cron');
const config = require('./config');
const logger = require('./utils/logger');

const scanner    = require('./bot/scanner');
const research   = require('./bot/research');
const prediction = require('./bot/prediction');
const riskManager = require('./bot/riskManager');
const executor   = require('./bot/executor');
const learner    = require('./bot/learner');
const notifier   = require('./utils/notifier');
const db         = require('./utils/db');

// ── SCHEDULER
// Startet die komplette Bot-Pipeline alle 15 Minuten (konfigurierbar)
// Jeder Schritt gibt seine Ergebnisse an den naechsten weiter

let isRunning = false;
let lastRunTime = null;
let lastRunResult = null;

// ── HAUPT-PIPELINE
async function runPipeline() {
  // Verhindert parallele Ausfuehrungen
  if (isRunning) {
    logger.warn('Pipeline bereits aktiv - ueberspringe');
    return;
  }

  if (riskManager.isKillSwitchActive()) {
    logger.warn('Kill Switch aktiv - Pipeline gestoppt');
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  logger.info('Pipeline gestartet', { time: new Date().toISOString() });

  try {
    // SCHRITT 1: Scanner - Maerkte finden
    logger.info('Schritt 1/5: Scanner');
    const scannedMarkets = await scanner.run();
    if (scannedMarkets.length === 0) {
      logger.info('Keine handelbaren Maerkte gefunden');
      return;
    }

    // SCHRITT 2: Research - News und Sentiment
    logger.info('Schritt 2/5: Research', { markets: scannedMarkets.length });
    const researchedMarkets = await research.run(scannedMarkets);

    // SCHRITT 3: Prediction - KI-Prognosen
    logger.info('Schritt 3/5: Prediction');
    const signalMarkets = await prediction.run(researchedMarkets);
    if (signalMarkets.length === 0) {
      logger.info('Keine Handelssignale mit ausreichend Edge');
      return;
    }

    // SCHRITT 4: Risikocheck fuer jedes Signal
    logger.info('Schritt 4/5: Risikocheck', { signals: signalMarkets.length });
    const approvedMarkets = [];

    for (const market of signalMarkets) {
      const riskResult = await riskManager.validate(market);
      if (riskResult.approved) {
        approvedMarkets.push({
          ...market,
          riskApproved:  true,
          positionSize:  riskResult.positionSize,
        });
      }
    }

    if (approvedMarkets.length === 0) {
      logger.info('Alle Trades durch Risikocheck abgelehnt');
      return;
    }

    // SCHRITT 5: Trades ausfuehren
    logger.info('Schritt 5/5: Trades ausfuehren', { trades: approvedMarkets.length });
    const executedTrades = await executor.run(approvedMarkets);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    lastRunTime = new Date().toISOString();
    lastRunResult = {
      scanned:  scannedMarkets.length,
      signals:  signalMarkets.length,
      approved: approvedMarkets.length,
      executed: executedTrades.length,
      duration: duration + 's',
    };

    logger.info('Pipeline abgeschlossen', lastRunResult);
  } catch (error) {
    logger.error('Pipeline Fehler', { message: error.message, stack: error.stack });
  } finally {
    isRunning = false;
  }
}

// ── DAILY REPORT (einmal taeglich, 23:55 Europe/Berlin)
// Schickt Tages-PnL + aktiven Kill-Switch-Status an Telegram. No-op wenn
// der Notifier nicht konfiguriert ist. Fehler werden nur geloggt, damit
// der Cron nie haengen bleibt.
async function runDailyReport() {
  try {
    const dailyPnl = await db.getDailyPnL();
    const ks = riskManager.isKillSwitchActive() ? ' 🛑 KILL-SWITCH AKTIV' : '';
    const sign = dailyPnl >= 0 ? '+' : '';
    await notifier.send(
      `📊 <b>Daily Report</b>\n` +
      `PnL heute: ${sign}${Number(dailyPnl).toFixed(2)} USDC${ks}\n` +
      `Letzter Run: ${lastRunTime || '-'}`
    );
    logger.info('Daily report gesendet', { dailyPnl });
  } catch (err) {
    logger.error('Daily report Fehler', { message: err.message });
  }
}

// ── LERN-PIPELINE (einmal taeglich)
async function runLearner() {
  logger.info('Lern-Pipeline gestartet');
  try {
    await learner.run();
  } catch (error) {
    logger.error('Lern-Pipeline Fehler', { message: error.message });
  }
}

// ── CRON JOBS STARTEN
function startScheduler() {
  const intervalMinutes = config.SCAN_INTERVAL_MINUTES;
  const cronExpression = `*/${intervalMinutes} * * * *`;

  logger.info('Scheduler gestartet', {
    interval: intervalMinutes + ' Minuten',
    cron: cronExpression,
  });

  // Haupt-Pipeline: alle X Minuten
  cron.schedule(cronExpression, runPipeline, {
    scheduled: true,
    timezone: 'Europe/Berlin',
  });

  // Lern-Pipeline: taeglich um 03:00 Uhr
  cron.schedule('0 3 * * *', runLearner, {
    scheduled: true,
    timezone: 'Europe/Berlin',
  });

  // Daily Report: taeglich um 23:55 Uhr
  cron.schedule('55 23 * * *', runDailyReport, {
    scheduled: true,
    timezone: 'Europe/Berlin',
  });

  // Ersten Run sofort starten (nach 5 Sekunden Delay)
  setTimeout(runPipeline, 5000);
}

// ── STATUS ABFRAGEN (fuer Dashboard-API)
function getStatus() {
  return {
    isRunning,
    killSwitchActive: riskManager.isKillSwitchActive(),
    lastRunTime,
    lastRunResult,
    nextRunIn: getNextRunTime(),
  };
}

function getNextRunTime() {
  const interval = config.SCAN_INTERVAL_MINUTES * 60 * 1000;
  if (!lastRunTime) return 'Bald';
  const next = new Date(new Date(lastRunTime).getTime() + interval);
  const diff = Math.max(0, next - Date.now());
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

module.exports = {
  startScheduler,
  runPipeline,
  runLearner,
  getStatus,
  activateKillSwitch:   () => riskManager.activateKillSwitch(),
  deactivateKillSwitch: () => riskManager.deactivateKillSwitch(),
};
