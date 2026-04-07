// ── HYPERLIQUID SDK CLIENT (internal)
// Duenner Wrapper um @nktkas/hyperliquid — erzeugt Info- und Exchange-Clients
// einmal beim Boot und stellt sie als Singletons bereit.
//
// Nutzt das Agent-Wallet-Pattern: der Agent-Private-Key signiert Transaktionen,
// gehandelt wird aber auf Konto der Vault-Adresse (Main-Wallet).
//
// Das eigentliche Adapter-Interface fuer Scanner/Executor liegt in hyperliquid.js.

'use strict';

const config = require('../config');
const logger = require('../utils/logger');

let _info = null;
let _exchange = null;
let _meta = null;
let _metaTimestamp = 0;
let _initError = null;
let _initialized = false;

const META_TTL_MS = 60 * 1000; // 1 Minute — Hyperliquid-Metadaten wechseln selten

function init() {
  if (_initialized) return { info: _info, exchange: _exchange, error: _initError };
  _initialized = true;

  try {
    // Lazy-require: erlaubt das Backend zu booten ohne @nktkas/hyperliquid
    // wenn HYPERLIQUID_* Env-Vars fehlen (Feature bleibt optional).
    // eslint-disable-next-line global-require
    const hl = require('@nktkas/hyperliquid');
    // eslint-disable-next-line global-require
    const viem = require('viem/accounts');

    const privateKey = config.HYPERLIQUID_PRIVATE_KEY;
    const vaultAddress = config.HYPERLIQUID_VAULT_ADDRESS;
    const network = config.HYPERLIQUID_NETWORK || 'mainnet';

    if (!privateKey) {
      _initError = 'HYPERLIQUID_PRIVATE_KEY not configured';
      logger.warn('Hyperliquid client: ' + _initError);
      return { info: null, exchange: null, error: _initError };
    }

    const wallet = viem.privateKeyToAccount(
      privateKey.startsWith('0x') ? privateKey : '0x' + privateKey
    );

    const isTestnet = network === 'testnet';
    const transport = new hl.HttpTransport({ isTestnet });
    _info = new hl.InfoClient({ transport });
    _exchange = new hl.ExchangeClient({
      wallet,
      transport,
      isTestnet,
      ...(vaultAddress ? { defaultVaultAddress: vaultAddress } : {}),
    });

    logger.info('Hyperliquid client initialized', {
      network,
      vault: vaultAddress ? vaultAddress.slice(0, 8) + '…' : '(none)',
    });
    return { info: _info, exchange: _exchange, error: null };
  } catch (err) {
    _initError = err.message;
    logger.error('Hyperliquid client init failed', { message: err.message });
    return { info: null, exchange: null, error: err.message };
  }
}

async function getMeta() {
  const now = Date.now();
  if (_meta && now - _metaTimestamp < META_TTL_MS) return _meta;
  const { info } = init();
  if (!info) return null;
  try {
    _meta = await info.metaAndAssetCtxs();
    _metaTimestamp = now;
    return _meta;
  } catch (err) {
    logger.warn('Hyperliquid getMeta failed', { message: err.message });
    return _meta; // Stale fallback
  }
}

// Helper: asset name "BTC" oder "xyz:TSLA" → Universe-Index fuer Perp-Orders
async function resolveAssetIndex(asset) {
  const meta = await getMeta();
  if (!meta || !meta[0] || !meta[0].universe) return null;
  const universe = meta[0].universe;
  const idx = universe.findIndex(u => u.name === asset);
  return idx >= 0 ? idx : null;
}

// Helper: sz-Decimals fuer Precision-Rounding
async function getSzDecimals(asset) {
  const meta = await getMeta();
  if (!meta || !meta[0] || !meta[0].universe) return 4;
  const entry = meta[0].universe.find(u => u.name === asset);
  return entry && Number.isFinite(entry.szDecimals) ? entry.szDecimals : 4;
}

// HIP-3 detection: assets im Format "dex:SYMBOL"
function isHip3(asset) {
  return typeof asset === 'string' && asset.includes(':');
}

function extractDex(asset) {
  return isHip3(asset) ? asset.split(':')[0] : null;
}

module.exports = {
  init,
  getMeta,
  resolveAssetIndex,
  getSzDecimals,
  isHip3,
  extractDex,
  // Fuer Tests / Debug
  _reset() {
    _info = null;
    _exchange = null;
    _meta = null;
    _metaTimestamp = 0;
    _initError = null;
    _initialized = false;
  },
};
