const axios = require('axios');
const logger = require('./logger');

// Telegram-Notifier. No-op wenn TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID fehlen.
// Fehler werden nur geloggt - Notifier darf niemals den Bot crashen.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function send(text) {
  if (!TOKEN || !CHAT_ID) return false;
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }, { timeout: 5000 });
    return true;
  } catch (err) {
    logger.warn('Telegram-Notifier Fehler', { error: err?.response?.data || err.message });
    return false;
  }
}

module.exports = {
  enabled: () => !!(TOKEN && CHAT_ID),
  send,
  tradeOpened: (t) => send(`🟢 <b>Trade geöffnet</b>\n${t.pair || t.market} ${t.signal?.toUpperCase() || ''}\nGröße: ${t.size || '-'}\nEntry: ${t.entry_price || '-'}`),
  tradeClosed: (t) => send(`🔴 <b>Trade geschlossen</b>\n${t.pair || t.market}\nPnL: ${t.pnl >= 0 ? '+' : ''}${Number(t.pnl || 0).toFixed(2)} USDC\nGrund: ${t.close_reason || '-'}`),
  tradeRejected: (market, reason) => send(`⚠️ <b>Trade abgelehnt</b>\n${market}\n${reason}`),
  circuitBreaker: (reason) => send(`🛑 <b>CIRCUIT BREAKER</b>\n${reason}`),
  error: (where, msg) => send(`❌ <b>Fehler</b>\n${where}: ${msg}`),
  info: (msg) => send(`ℹ️ ${msg}`),
};
