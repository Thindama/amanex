# Amanex Backend – Setup-Anleitung

## Projektstruktur

```
amanex-backend/
  src/
    config/index.js      ← Alle Konfigurationen
    utils/
      logger.js          ← Logging
      db.js              ← Supabase-Datenbankzugriff
    api/
      kalshi.js          ← Kalshi REST API Client
      polymarket.js      ← Polymarket CLOB API Client
    bot/
      scanner.js         ← Schritt 1: Maerkte scannen
      research.js        ← Schritt 2: News & Sentiment
      prediction.js      ← Schritt 3: KI-Prognosen
      riskManager.js     ← Schritt 4: Risikocheck & Kelly
      executor.js        ← Schritt 5: Trade ausfuehren
      learner.js         ← Schritt 6: Aus Fehlern lernen
    scheduler.js         ← Automatische Pipeline alle 15 Min.
    server.js            ← Express API Server
  database/
    schema.sql           ← Datenbankschema fuer Supabase
  .env.example           ← Alle benoetigten Umgebungsvariablen
  package.json
```

---

## Deployment-Anleitung

### Schritt 1 – Supabase einrichten

1. Account auf supabase.com erstellen
2. Neues Projekt anlegen
3. SQL-Editor oeffnen
4. Inhalt von `database/schema.sql` einfuegen und ausfuehren
5. Folgende Werte notieren:
   - Project URL → `SUPABASE_URL`
   - anon public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_KEY`

### Schritt 2 – Umgebungsvariablen

1. `.env.example` kopieren als `.env`
2. Alle API Keys eintragenU (siehe unten)
3. `KALSHI_ENV=demo` lassen (erst nach 50+ erfolgreichen Demo-Trades auf `live` umstellen)

### Schritt 3 – Server deployen (Railway empfohlen)

```bash
# Lokal testen
npm install
npm start

# Railway Deployment
railway login
railway new
railway up
```

### Schritt 4 – Admin-Passwort setzen

```bash
# Passwort-Hash generieren
node -e "const b=require('bcryptjs'); b.hash('IhrSicheresPasswort', 10).then(console.log)"

# Hash in Supabase eintragen:
# UPDATE users SET password_hash = 'DerGenerierteHash' WHERE email = 'admin@amanex.de';
```

### Schritt 5 – Frontend verbinden

Im Frontend (React) alle API-Calls auf die Backend-URL zeigen:
```
REACT_APP_API_URL=https://ihr-backend.railway.app
```

---

## API Keys beschaffen

| Dienst | URL | Hinweis |
|--------|-----|---------|
| Anthropic | console.anthropic.com | Claude API |
| xAI (Grok) | console.x.ai | Grok API |
| OpenAI | platform.openai.com | GPT-4o |
| Google | aistudio.google.com | Gemini |
| DeepSeek | platform.deepseek.com | DeepSeek |
| Kalshi | kalshi.com/api | Demo zuerst! |
| Polymarket | docs.polymarket.com | Ethereum Wallet noetig |
| Twitter/X | developer.twitter.com | Basic Plan min. |
| Reddit | reddit.com/prefs/apps | Kostenlos |

---

## Wichtige Hinweise

- **Kalshi Demo**: Immer mit `KALSHI_ENV=demo` starten
- **Polymarket**: Benoetigt ethers.js und Ethereum Private Key
- **API-Kosten**: Taeglich auf $50 begrenzt (konfigurierbar)
- **Kill Switch**: POST /api/bot/stop (nur Admin)
- **Logs**: Werden in `logs/` gespeichert

---

## API Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | /health | Server-Status |
| POST | /api/auth/login | Anmelden |
| GET | /api/bot/status | Bot-Status |
| POST | /api/bot/start | Bot starten |
| POST | /api/bot/stop | Kill Switch |
| POST | /api/bot/scan | Manueller Scan |
| GET | /api/dashboard/metrics | Live-Kennzahlen |
| GET | /api/trades | Trade-Historie |
| GET | /api/scanner/results | Scanner-Ergebnisse |
| GET | /api/knowledge | Wissensbasis |
| GET | /api/settings | Bot-Einstellungen |
| PUT | /api/settings | Einstellungen speichern |
| GET | /api/team | Team-Mitglieder |
