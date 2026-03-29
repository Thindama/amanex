const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./utils/db');
const scheduler = require('./scheduler');

const app = express();

// ── CORS – mehrere Domains erlauben
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'https://app.amanex.de',
  'https://amanex.de',
  'https://amanex-frontend.vercel.app',
  'http://localhost:3001',
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Requests ohne Origin (z.B. Postman, Railway Health) immer erlauben
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS nicht erlaubt: ' + origin));
  },
  credentials: true,
}));

app.use(express.json());

// Request-Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// JWT-Authentifizierung
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Token' });
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token ungueltig' });
  }
}

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }
    const { data: user, error } = await db.supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Ungueltige Anmeldedaten' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Ungueltige Anmeldedaten' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );
    logger.info('Login erfolgreich', { email: user.email });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    logger.error('Login Fehler', { message: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ══════════════════════════════════════════
// DASHBOARD ROUTES
// ══════════════════════════════════════════

app.get('/api/bot/status', auth, (req, res) => {
  res.json(scheduler.getStatus());
});

app.post('/api/bot/start', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  scheduler.deactivateKillSwitch();
  res.json({ success: true, message: 'Bot gestartet' });
});

app.post('/api/bot/stop', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  scheduler.activateKillSwitch();
  res.json({ success: true, message: 'Bot gestoppt' });
});

app.post('/api/bot/scan', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  scheduler.runPipeline();
  res.json({ success: true, message: 'Scan gestartet' });
});

app.get('/api/dashboard/metrics', auth, async (req, res) => {
  try {
    const [balance, settings, openTrades] = await Promise.all([
      db.getAccountBalance(),
      db.getBotSettings(),
      db.getOpenTrades(),
    ]);
    const dailyPnl = await db.getDailyPnL();
    res.json({
      balance: Math.round(balance),
      dailyPnl: Math.round(dailyPnl),
      winRate: parseFloat(settings.win_rate) || 0,
      totalPnl: parseFloat(settings.total_pnl) || 0,
      totalTrades: parseInt(settings.total_trades) || 0,
      profitFactor: parseFloat(settings.profit_factor) || 0,
      brierScore: parseFloat(settings.brier_score) || 0,
      sharpeRatio: parseFloat(settings.sharpe_ratio) || 0,
      openPositions: openTrades.length,
      maxPositions: config.MAX_CONCURRENT_TRADES,
    });
  } catch (error) {
    logger.error('Metrics Fehler', { message: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/trades', auth, async (req, res) => {
  try {
    const { status, platform, limit = 50, offset = 0 } = req.query;
    let query = db.supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    if (status) query = query.eq('status', status);
    if (platform) query = query.eq('platform', platform);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    logger.error('Trades Fehler', { message: error.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/scanner/results', auth, async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('markets').select('*')
      .order('edge_score', { ascending: false }).limit(20);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/knowledge', auth, async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('knowledge_base').select('*')
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/settings', auth, async (req, res) => {
  try {
    const settings = await db.getBotSettings();
    delete settings.peak_balance;
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/settings', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  try {
    const allowedKeys = [
      'scan_interval_minutes','min_edge_pct','max_position_pct',
      'max_concurrent_trades','max_daily_loss_pct','max_drawdown_pct',
      'kelly_fraction','daily_api_cost_limit','active_hours',
    ];
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedKeys.includes(key)) {
        await db.supabase.from('bot_settings').upsert({ key, value: String(value) });
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/team', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  try {
    const { data, error } = await db.supabase
      .from('users').select('id, email, role, created_at').order('created_at');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString(), bot: scheduler.getStatus() });
});

app.use((req, res) => res.status(404).json({ error: 'Route nicht gefunden' }));

app.use((error, req, res, next) => {
  logger.error('Unbehandelter Fehler', { message: error.message });
  res.status(500).json({ error: 'Interner Serverfehler' });
});

const PORT = config.PORT;
app.listen(PORT, () => {
  logger.info('Amanex Backend gestartet', { port: PORT, env: config.NODE_ENV });
  scheduler.startScheduler();
});

module.exports = app;
