# Phase 2 — Hyperliquid-Aktivierung

Checklist zum Live-Schalten der Hyperliquid-Schiene nach den Code-Fixes in Commit `<Phase 2>`. Die gesamte Pipeline (Scanner → Research → Prediction → RiskManager → Executor) unterstuetzt Perps jetzt von Ende zu Ende. Alles was noch fehlt sind die Credentials + ein Trockenlauf auf dem Testnet.

## Was Phase 2 im Code macht

1. **`config/index.js`** — neue Felder:
   - `HYPERLIQUID_PRIVATE_KEY` (Agent-Signer, NICHT die Main-Wallet)
   - `HYPERLIQUID_VAULT_ADDRESS` (Main-Wallet mit Funds)
   - `HYPERLIQUID_NETWORK` (default `mainnet`, setze `testnet` zum Testen)
   - `HYPERLIQUID_ASSETS` (default `BTC ETH SOL`)
   - `HYPERLIQUID_INTERVAL` (default `5m`)
   - `CLAUDE_MODEL_HYPERLIQUID` (default `claude-sonnet-4-6`)
   - `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` (waren vorher nur indirekt)
   - `RISK_GATE_ALL` (Flag — `1` schaltet das globale Risk-Gate auch fuer Kraken scharf)
2. **`bot/executor.js`** — Signal-Normalisierung am Anfang von `run()`: `BUY_YES`/`LONG`/`KAUF` -> `BUY`, `BUY_NO`/`SHORT`/`VERK` -> `SELL`, sonst `HOLD` (und uebersprungen). Ohne das fiel jeder vom prediction-Pipeline erzeugte Trade still durchs Raster.
3. **`bot/executor.js`** — `getStateFor('hyperliquid')` liest/persistiert `hl_initial_balance` in `bot_settings`, damit die 20% Balance-Reserve nach dem ersten Scan eine echte Baseline hat und nicht alle neuen Trades blockiert.
4. **`bot/scanner.js`** — `scanHyperliquid()` und der Force-Close-Check ueberspringen sich selbst geraeuschlos wenn `HYPERLIQUID_PRIVATE_KEY` nicht gesetzt ist (`HL_ENABLED`-Gate). Kein Log-Spam mehr wenn nur Kraken laeuft.
5. **`bot/prediction.js`** — Zwei-Modus-Prompt:
   - **Prediction-Markets** (`kalshi`, `polymarket`) bekommen den alten Prompt mit `yesPrice` als Baseline
   - **Spot / Perp / Stock** bekommen einen Richtungs-Prompt mit Preis/RSI/Funding und nutzen `0.5` als Baseline. `edge = (KI-Wahrscheinlichkeit - 0.5) * 100`. Das Signal-Format ist automatisch `BUY/SELL/HOLD` statt `BUY_YES/BUY_NO/HOLD`.

## Railway-ENV-Vars setzen

Im Railway-Dashboard (Service `amanex`) unter *Variables* hinzufuegen:

```
HYPERLIQUID_PRIVATE_KEY=0x<64-hex-chars>     # Agent-Wallet Private Key
HYPERLIQUID_VAULT_ADDRESS=0x<40-hex-chars>   # Main-Wallet Address
HYPERLIQUID_NETWORK=testnet                  # ERST testnet, spaeter mainnet
HYPERLIQUID_ASSETS=BTC ETH SOL               # Oder erweitern auf xyz:TSLA, xyz:GOLD fuer HIP-3
HYPERLIQUID_INTERVAL=5m
```

Optional:
```
CLAUDE_MODEL_HYPERLIQUID=claude-sonnet-4-6
RISK_MAX_POSITION_PCT=2                      # Waehrend Testnet-Phase konservativ
RISK_MAX_LEVERAGE=5
RISK_GATE_ALL=0                              # NICHT auf 1 bis Hyperliquid validiert
```

**Wichtig — Agent-Wallet-Pattern:**
- Der `HYPERLIQUID_PRIVATE_KEY` ist ein *Agent-Signer*, NICHT die Main-Wallet mit den Funds. Anlegen via [Hyperliquid-App](https://app.hyperliquid.xyz/API) unter *API Wallet*.
- Der Agent darf nur traden, nicht abheben. Wenn er kompromittiert wird, sind die Funds in der Vault sicher.
- `HYPERLIQUID_VAULT_ADDRESS` ist die Adresse deiner Main-Wallet — dort muessen die USDC liegen.

## Testnet-Rollout (empfohlen)

1. **Testnet-Wallet anlegen**: https://app.hyperliquid-testnet.xyz/ → API Wallet erzeugen → Key kopieren
2. **Testnet-USDC holen**: Testnet-Faucet via Discord/docs
3. **Railway-Vars setzen** mit `HYPERLIQUID_NETWORK=testnet`
4. **Deploy** (automatisch nach Push)
5. **Scanner pruefen**: `curl https://amanex-production.up.railway.app/api/scanner/results` → sollte jetzt zusaetzlich `platform: hyperliquid` Eintraege enthalten fuer BTC/ETH/SOL
6. **Bot aktivieren** via Frontend BotControl → *Trading aktivieren*
7. **Ersten Trade beobachten**: Railway-Logs → sollte `Hyperliquid Trade erfolgreich` mit `tradeId` und `orderId` zeigen
8. **Position pruefen**: auf hyperliquid-testnet.xyz im Portfolio

## Mainnet-Switch (nach Testnet-Bestaetigung)

1. Agent-Wallet fuer Mainnet neu anlegen (keine Test/Mainnet-Key-Mischung!)
2. USDC auf Main-Wallet in der Hyperliquid-App einzahlen
3. Railway: `HYPERLIQUID_NETWORK=mainnet` + neue Keys
4. **Zuerst konservativ**: `RISK_MAX_POSITION_PCT=2`, nur `HYPERLIQUID_ASSETS=BTC`
5. 24-48h ueberwachen, dann auf 10% + volle Asset-Liste skalieren

## Was bei Problemen zu pruefen ist

- `/health` muss ok sein (Supabase + bot-status)
- Railway-Logs: `Hyperliquid client initialized` beim Start → wenn *nicht* da ist, ist der Key kaputt
- `Hyperliquid scan Fehler` pro Asset → meist Netzwerk oder falscher Asset-Name
- `Risk reject` im Log → Reason zeigt welcher Guard getriggert hat (Position/Reserve/Circuit-Breaker)
- `hl_initial_balance` in Supabase `bot_settings` muss einen Wert haben, sonst blockiert die Reserve
