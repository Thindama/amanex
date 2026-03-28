-- ════════════════════════════════════
-- AMANEX TRADING BOT - DATENBANKSCHEMA
-- Fuer Supabase (PostgreSQL)
-- Reihenfolge wichtig: Tabellen vor Policies anlegen
-- ════════════════════════════════════

-- ── USERS
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer')),
  team_id       UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── MARKETS (Scanner-Ergebnisse)
CREATE TABLE IF NOT EXISTS markets (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL CHECK (platform IN ('kalshi','polymarket')),
  title         TEXT NOT NULL,
  yes_price     DECIMAL(5,4),
  volume        INTEGER,
  expiry_days   INTEGER,
  spread        DECIMAL(5,4),
  edge_score    DECIMAL(5,4),
  status        TEXT DEFAULT 'open',
  last_scanned  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREDICTIONS (KI-Prognosen pro Modell)
CREATE TABLE IF NOT EXISTS predictions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     TEXT REFERENCES markets(id),
  platform      TEXT,
  model_name    TEXT NOT NULL,
  probability   DECIMAL(5,4) NOT NULL,
  weight        DECIMAL(5,4),
  edge_pct      DECIMAL(6,2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRADES
CREATE TABLE IF NOT EXISTS trades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     TEXT,
  platform      TEXT NOT NULL,
  market_title  TEXT,
  side          TEXT NOT NULL CHECK (side IN ('yes','no')),
  amount        DECIMAL(12,2) NOT NULL,
  contracts     INTEGER,
  entry_price   DECIMAL(5,4) NOT NULL,
  exit_price    DECIMAL(5,4),
  pnl           DECIMAL(12,2),
  ai_consensus  DECIMAL(5,4),
  edge_pct      DECIMAL(6,2),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','failed')),
  order_id      TEXT,
  analyzed      BOOLEAN DEFAULT FALSE,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── KNOWLEDGE BASE (Lektionen aus Verlusten)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id        UUID REFERENCES trades(id),
  market_id       TEXT,
  platform        TEXT,
  failure_type    TEXT NOT NULL,
  market_category TEXT,
  lesson          TEXT NOT NULL,
  entry_price     DECIMAL(5,4),
  ai_consensus    DECIMAL(5,4),
  edge_pct        DECIMAL(6,2),
  pnl             DECIMAL(12,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── BOT SETTINGS (Konfiguration & Metriken)
CREATE TABLE IF NOT EXISTS bot_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── STANDARD-EINSTELLUNGEN
INSERT INTO bot_settings (key, value) VALUES
  ('account_balance',          '10000'),
  ('peak_balance',             '10000'),
  ('scan_interval_minutes',    '15'),
  ('min_edge_pct',             '4'),
  ('max_position_pct',         '5'),
  ('max_concurrent_trades',    '15'),
  ('max_daily_loss_pct',       '15'),
  ('max_drawdown_pct',         '8'),
  ('kelly_fraction',           '0.25'),
  ('daily_api_cost_limit',     '50'),
  ('win_rate',                 '0'),
  ('total_pnl',                '0'),
  ('total_trades',             '0'),
  ('profit_factor',            '0'),
  ('brier_score',              '0'),
  ('sharpe_ratio',             '0'),
  ('bot_active',               'true')
ON CONFLICT (key) DO NOTHING;

-- ── INDEXES (Performance)
CREATE INDEX IF NOT EXISTS idx_trades_status     ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_platform   ON trades(platform);
CREATE INDEX IF NOT EXISTS idx_trades_created    ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_analyzed   ON trades(analyzed) WHERE analyzed = FALSE;
CREATE INDEX IF NOT EXISTS idx_predictions_market ON predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_kb_failure_type   ON knowledge_base(failure_type);
CREATE INDEX IF NOT EXISTS idx_markets_platform  ON markets(platform);

-- ── ROW LEVEL SECURITY (RLS)
-- Schuetzt Daten vor unerlaubtem Zugriff

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets        ENABLE ROW LEVEL SECURITY;

-- Service Role hat vollen Zugriff (Backend)
CREATE POLICY "service_role_all_users"          ON users          FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all_trades"         ON trades         FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all_predictions"    ON predictions    FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all_knowledge"      ON knowledge_base FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all_bot_settings"   ON bot_settings   FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_role_all_markets"        ON markets        FOR ALL TO service_role USING (TRUE);

-- ── ADMIN-BENUTZER ANLEGEN (Passwort vor Produktionsbetrieb aendern!)
-- Das Passwort muss als bcrypt-Hash eingefuegt werden.
-- Beispiel-Hash fuer "admin1234" (VOR PRODUKTIONSBETRIEB AENDERN):
-- $2a$10$YourHashHere
-- Befehl zum Erstellen: node -e "const b=require('bcryptjs');b.hash('IhrPasswort',10).then(console.log)"
INSERT INTO users (email, password_hash, role)
VALUES ('admin@amanex.de', '$2a$10$placeholder_change_before_production', 'admin')
ON CONFLICT (email) DO NOTHING;
