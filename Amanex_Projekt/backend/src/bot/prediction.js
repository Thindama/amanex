const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('../utils/db');

// ── PREDICTION MODUL
// Fragt alle 5 KI-Modelle unabhaengig ab
// Berechnet gewichteten Konsens
// Gibt Signal nur wenn Edge > 4% gegenueber Marktpreis

const prediction = {
  async run(markets) {
    logger.info('Prediction gestartet', { markets: markets.length });

    const results = [];
    for (const market of markets) {
      const result = await this.predictMarket(market);
      if (result) results.push(result);
    }

    // Nur Maerkte mit ausreichend Edge weitergeben
    const signals = results.filter(r => Math.abs(r.edge) >= config.MIN_EDGE_PCT);

    logger.info('Prediction abgeschlossen', {
      total: results.length,
      signals: signals.length,
    });

    return signals;
  },

  async predictMarket(market) {
    try {
      const prompt = this.buildPrompt(market);

      // Alle 5 Modelle parallel abfragen
      const [grokResult, claudeResult, gpt4oResult, geminiResult, deepseekResult] = await Promise.allSettled([
        this.queryGrok(prompt),
        this.queryClaude(prompt),
        this.queryGPT4o(prompt),
        this.queryGemini(prompt),
        this.queryDeepSeek(prompt),
      ]);

      // Ergebnisse extrahieren
      const predictions = {
        grok:     grokResult.status     === 'fulfilled' ? grokResult.value     : null,
        claude:   claudeResult.status   === 'fulfilled' ? claudeResult.value   : null,
        gpt4o:    gpt4oResult.status    === 'fulfilled' ? gpt4oResult.value    : null,
        gemini:   geminiResult.status   === 'fulfilled' ? geminiResult.value   : null,
        deepseek: deepseekResult.status === 'fulfilled' ? deepseekResult.value : null,
      };

      // Gewichteten Konsens berechnen
      const consensus = this.calculateConsensus(predictions);
      if (!consensus) return null;

      // Edge berechnen
      const edge = Math.round((consensus.probability - market.yesPrice) * 100 * 10) / 10;

      // In DB speichern
      await db.savePrediction({
        market_id:   market.id,
        platform:    market.platform,
        model_name:  'consensus',
        probability: consensus.probability,
        weight:      1.0,
        edge_pct:    edge,
        created_at:  new Date().toISOString(),
      });

      logger.info('Prediction berechnet', {
        market: market.title.substring(0, 50),
        marketPrice:  market.yesPrice,
        aiEstimate:   consensus.probability,
        edge:         edge + '%',
        confidence:   consensus.confidence,
      });

      return {
        ...market,
        predictions,
        consensus: consensus.probability,
        confidence: consensus.confidence,
        edge,
        // Handelsempfehlung
        signal: edge >= config.MIN_EDGE_PCT ? 'BUY_YES' :
                edge <= -config.MIN_EDGE_PCT ? 'BUY_NO' : 'HOLD',
      };
    } catch (error) {
      logger.error('Prediction Fehler', { market: market.id, message: error.message });
      return null;
    }
  },

  // ── KI-MODELL ABFRAGEN

  async queryGrok(prompt) {
    if (!config.XAI_API_KEY) throw new Error('Grok API Key fehlt');

    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-beta',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1,
    }, {
      headers: {
        Authorization: `Bearer ${config.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return this.extractProbability(response.data.choices[0]?.message?.content);
  },

  async queryClaude(prompt) {
    if (!config.ANTHROPIC_API_KEY) throw new Error('Anthropic API Key fehlt');

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        'x-api-key': config.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return this.extractProbability(response.data.content[0]?.text);
  },

  async queryGPT4o(prompt) {
    if (!config.OPENAI_API_KEY) throw new Error('OpenAI API Key fehlt');

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1,
    }, {
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return this.extractProbability(response.data.choices[0]?.message?.content);
  },

  async queryGemini(prompt) {
    if (!config.GOOGLE_API_KEY) throw new Error('Google API Key fehlt');

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GOOGLE_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 50, temperature: 0.1 },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    return this.extractProbability(
      response.data.candidates?.[0]?.content?.parts?.[0]?.text
    );
  },

  async queryDeepSeek(prompt) {
    if (!config.DEEPSEEK_API_KEY) throw new Error('DeepSeek API Key fehlt');

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1,
    }, {
      headers: {
        Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    return this.extractProbability(response.data.choices[0]?.message?.content);
  },

  // ── HILFSFUNKTIONEN

  buildPrompt(market) {
    const researchSummary = market.research?.summaryItems
      ?.map(s => `[${s.source.toUpperCase()}] ${s.text}`)
      .join('\n') || 'Keine Research-Daten verfuegbar';

    return `Du bist ein Prediction-Market-Analyst. Schaetze die Wahrscheinlichkeit fuer folgendes Ereignis.

MARKT: ${market.title}
AKTUELLER MARKTPREIS: ${Math.round(market.yesPrice * 100)}% (JA-Wahrscheinlichkeit)
AKTUELLE NACHRICHTEN:
${researchSummary}
SENTIMENT-SCORE: ${market.sentiment || 0} (von -1 bearish bis +1 bullish)

Antworte NUR mit einer Zahl zwischen 0 und 100 (= deine geschaetzte JA-Wahrscheinlichkeit in Prozent).
Keine Erklaerung, nur die Zahl. Beispiel: 67`;
  },

  extractProbability(text) {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/\b(\d{1,3}(?:\.\d+)?)\b/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    if (value < 0 || value > 100) return null;
    return Math.round(value) / 100; // 0-1
  },

  calculateConsensus(predictions) {
    const weights = config.AI_WEIGHTS;
    let weightedSum = 0;
    let totalWeight = 0;
    let modelCount = 0;

    for (const [model, probability] of Object.entries(predictions)) {
      if (probability === null || probability === undefined) continue;
      const weight = weights[model] || 0;
      weightedSum += probability * weight;
      totalWeight += weight;
      modelCount++;
    }

    if (modelCount === 0 || totalWeight === 0) return null;

    const probability = Math.round((weightedSum / totalWeight) * 100) / 100;

    // Konfidenz: Wie viele Modelle haben geantwortet?
    const confidence = modelCount >= 4 ? 'high' : modelCount >= 3 ? 'medium' : 'low';

    return { probability, confidence, modelCount };
  },

  // Brier Score berechnen (Kalibrierungsmetrik - niedriger ist besser)
  calculateBrierScore(predictions, outcomes) {
    if (!predictions || predictions.length === 0) return null;
    const sum = predictions.reduce((acc, p, i) => {
      return acc + Math.pow(p - outcomes[i], 2);
    }, 0);
    return Math.round((sum / predictions.length) * 1000) / 1000;
  },
};

module.exports = prediction;
