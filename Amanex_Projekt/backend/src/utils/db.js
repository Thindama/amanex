const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

module.exports = {
  supabase,

  async saveTrade(trade) {
    const { data, error } = await supabase.from('trades').insert(trade).select().single();
    if (error) throw error;
    return data;
  },

  async updateTrade(id, updates) {
    const { data, error } = await supabase.from('trades').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async getOpenTrades() {
    const { data, error } = await supabase.from('trades').select('*').eq('status', 'open');
    if (error) throw error;
    return data || [];
  },

  async savePrediction(prediction) {
    const { data, error } = await supabase.from('predictions').insert(prediction).select().single();
    if (error) throw error;
    return data;
  },

  async saveLesson(lesson) {
    const { data, error } = await supabase.from('knowledge_base').insert(lesson).select().single();
    if (error) throw error;
    return data;
  },

  async getBotSettings() {
    const { data, error } = await supabase.from('bot_settings').select('*');
    if (error) throw error;
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return settings;
  },

  async getAccountBalance() {
    const { data, error } = await supabase
      .from('bot_settings').select('value').eq('key', 'account_balance').single();
    if (error) return 10000;
    return parseFloat(data.value) || 10000;
  },

  async updateBalance(balance) {
    await supabase.from('bot_settings')
      .upsert({ key: 'account_balance', value: String(balance), updated_at: new Date().toISOString() });
  },

  async getDailyPnL() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('trades')
      .select('pnl')
      .gte('created_at', today)
      .eq('status', 'closed');
    if (error) return 0;
    return (data || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
  },

  // ── MARKETS-PERSISTIERUNG
  // Wird vom Scanner nach jedem Cycle aufgerufen. Upsert anhand der
  // Market-ID, damit die Tabelle nicht unendlich waechst.
  async saveMarkets(markets) {
    if (!Array.isArray(markets) || markets.length === 0) return;
    const rows = markets.map(m => ({
      id:           String(m.id),
      platform:     m.platform || 'unknown',
      title:        m.title || String(m.id),
      yes_price:    typeof m.yesPrice === 'number' ? m.yesPrice : null,
      price:        typeof m.price === 'number' ? m.price : null,
      change_24h:   typeof m.change24h === 'number' ? m.change24h : null,
      volume:       typeof m.volume === 'number' ? Math.round(m.volume) : null,
      rsi:          typeof m.rsi === 'number' ? Math.round(m.rsi) : null,
      edge_score:   typeof m.edgeScore === 'number' ? m.edgeScore : null,
      signal:       m.signal || null,
      currency:     m.currency || null,
      status:       'open',
      last_scanned: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('markets')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    return rows.length;
  },

  async getLatestMarkets(limit = 20) {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .order('edge_score', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  },

  async getLastScanTime() {
    const { data, error } = await supabase
      .from('markets')
      .select('last_scanned')
      .order('last_scanned', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.last_scanned;
  },
};
