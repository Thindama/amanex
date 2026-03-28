require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  // KI-Modelle
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,

  // Maerkte
  KALSHI_API_KEY: process.env.KALSHI_API_KEY,
  KALSHI_API_SECRET: process.env.KALSHI_API_SECRET,
  KALSHI_ENV: process.env.KALSHI_ENV || 'demo',
  POLYMARKET_PRIVATE_KEY: process.env.POLYMARKET_PRIVATE_KEY,

  // Datenquellen
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
  REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,

  // Bot-Parameter
  SCAN_INTERVAL_MINUTES: parseInt(process.env.SCAN_INTERVAL_MINUTES) || 15,
  MIN_VOLUME: 200,
  MAX_EXPIRY_DAYS: 30,
  MIN_EDGE_PCT: 4,
  MAX_POSITION_PCT: 5,
  MAX_CONCURRENT_TRADES: 15,
  MAX_DAILY_LOSS_PCT: 15,
  MAX_DRAWDOWN_PCT: 8,
  DAILY_API_COST_LIMIT_USD: parseFloat(process.env.DAILY_API_COST_LIMIT_USD) || 50,
  KELLY_FRACTION: 0.25, // Viertel-Kelly

  // KI-Gewichtungen
  AI_WEIGHTS: {
    grok:     0.30,
    claude:   0.20,
    gpt4o:    0.20,
    gemini:   0.15,
    deepseek: 0.15,
  },

  // API URLs
  KALSHI_BASE_URL: process.env.KALSHI_ENV === 'live'
    ? 'https://trading-api.kalshi.com/trade-api/v2'
    : 'https://demo-api.kalshi.co/trade-api/v2',
  POLYMARKET_CLOB_URL: 'https://clob.polymarket.com',
  POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com',
};
