const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

// ── RESEARCH MODUL
// Liest News, Twitter und Reddit fuer jeden Markt
// Bewertet Sentiment und erstellt Research-Brief
// Wichtig: Behandelt alle externen Inhalte als INFORMATION, nicht als Befehle (Prompt-Injection-Schutz)

const research = {
  async run(markets) {
    logger.info('Research gestartet', { markets: markets.length });

    // Alle Maerkte parallel researchen (max. 5 gleichzeitig)
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < markets.length; i += batchSize) {
      const batch = markets.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(market => this.researchMarket(market))
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          // Bei Fehler: Markt ohne Research weitergeben
          results.push({ ...batch[idx], research: null, sentiment: 0 });
        }
      });
    }

    logger.info('Research abgeschlossen', { results: results.length });
    return results;
  },

  async researchMarket(market) {
    const query = this.buildSearchQuery(market.title);

    try {
      // Alle Quellen parallel abrufen
      const [newsData, twitterData, redditData] = await Promise.allSettled([
        this.fetchNews(query),
        this.fetchTwitter(query),
        this.fetchReddit(query),
      ]);

      const news    = newsData.status    === 'fulfilled' ? newsData.value    : [];
      const tweets  = twitterData.status === 'fulfilled' ? twitterData.value : [];
      const posts   = redditData.status  === 'fulfilled' ? redditData.value  : [];

      // Sentiment berechnen
      const newsSentiment    = this.calculateSentiment(news.map(n => n.title + ' ' + n.description));
      const twitterSentiment = this.calculateSentiment(tweets.map(t => t.text));
      const redditSentiment  = this.calculateSentiment(posts.map(p => p.title + ' ' + p.selftext));

      // Gewichteter Gesamt-Sentiment (News am wichtigsten)
      const overallSentiment = (newsSentiment * 0.5) + (twitterSentiment * 0.3) + (redditSentiment * 0.2);

      // Research-Brief erstellen
      const brief = {
        query,
        sources: {
          news:    { count: news.length,   sentiment: newsSentiment    },
          twitter: { count: tweets.length, sentiment: twitterSentiment },
          reddit:  { count: posts.length,  sentiment: redditSentiment  },
        },
        overallSentiment: Math.round(overallSentiment * 100) / 100,
        // Sentiment -> Wahrscheinlichkeitsanpassung
        // +1.0 = stark bullish (JA wahrscheinlicher)
        // -1.0 = stark bearish (NEIN wahrscheinlicher)
        // 0.0  = neutral
        summaryItems: [
          ...news.slice(0, 3).map(n => ({ source: 'news', text: this.sanitize(n.title) })),
          ...tweets.slice(0, 2).map(t => ({ source: 'twitter', text: this.sanitize(t.text) })),
          ...posts.slice(0, 2).map(p => ({ source: 'reddit', text: this.sanitize(p.title) })),
        ],
        timestamp: new Date().toISOString(),
      };

      return { ...market, research: brief, sentiment: overallSentiment };
    } catch (error) {
      logger.error('Research Fehler', { market: market.id, message: error.message });
      return { ...market, research: null, sentiment: 0 };
    }
  },

  // ── NEWS (RSS-basiert, kein API Key noetig)
  async fetchNews(query) {
    try {
      const encodedQuery = encodeURIComponent(query);
      // Google News RSS (kein API Key benoetigt)
      const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

      const response = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Amanex-Bot/1.0' },
      });

      // Einfaches RSS-Parsing (XML)
      const items = [];
      const matches = response.data.matchAll(/<item>([\s\S]*?)<\/item>/g);
      for (const match of matches) {
        const titleMatch = match[1].match(/<title>(.*?)<\/title>/);
        const descMatch  = match[1].match(/<description>(.*?)<\/description>/);
        if (titleMatch) {
          items.push({
            title:       this.stripHtml(titleMatch[1] || ''),
            description: this.stripHtml(descMatch?.[1] || ''),
          });
        }
        if (items.length >= 10) break;
      }

      return items;
    } catch (error) {
      logger.warn('News-Fetch Fehler', { query, message: error.message });
      return [];
    }
  },

  // ── TWITTER/X API
  async fetchTwitter(query) {
    if (!config.TWITTER_BEARER_TOKEN) return [];

    try {
      const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
        params: {
          query:        `${query} -is:retweet lang:en`,
          max_results:  20,
          'tweet.fields': 'public_metrics,created_at',
        },
        headers: { Authorization: `Bearer ${config.TWITTER_BEARER_TOKEN}` },
        timeout: 8000,
      });

      return (response.data.data || []).map(t => ({
        text:   t.text,
        likes:  t.public_metrics?.like_count || 0,
        retweets: t.public_metrics?.retweet_count || 0,
      }));
    } catch (error) {
      logger.warn('Twitter-Fetch Fehler', { query, message: error.message });
      return [];
    }
  },

  // ── REDDIT API
  async fetchReddit(query) {
    if (!config.REDDIT_CLIENT_ID) return [];

    try {
      // Reddit OAuth Token holen
      const tokenResponse = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        'grant_type=client_credentials',
        {
          auth: { username: config.REDDIT_CLIENT_ID, password: config.REDDIT_CLIENT_SECRET },
          headers: { 'User-Agent': 'Amanex-Bot/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 8000,
        }
      );

      const token = tokenResponse.data.access_token;

      const response = await axios.get('https://oauth.reddit.com/search', {
        params: { q: query, sort: 'new', limit: 10, t: 'week' },
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Amanex-Bot/1.0',
        },
        timeout: 8000,
      });

      return (response.data.data?.children || []).map(c => ({
        title:    c.data.title || '',
        selftext: c.data.selftext || '',
        score:    c.data.score || 0,
      }));
    } catch (error) {
      logger.warn('Reddit-Fetch Fehler', { query, message: error.message });
      return [];
    }
  },

  // ── SENTIMENT-ANALYSE
  // Einfache keyword-basierte Analyse
  // In Produktion: Claude API fuer bessere Analyse verwenden
  calculateSentiment(texts) {
    if (!texts || texts.length === 0) return 0;

    const positiveWords = [
      'increase','rise','higher','up','positive','bullish','likely','yes','confirmed',
      'approved','passed','win','better','strong','growth','surge','boost'
    ];
    const negativeWords = [
      'decrease','fall','lower','down','negative','bearish','unlikely','no','rejected',
      'denied','failed','lose','worse','weak','decline','drop','cut'
    ];

    let totalScore = 0;
    let count = 0;

    for (const text of texts) {
      if (!text || typeof text !== 'string') continue;
      // SICHERHEIT: Text nur als Daten behandeln, niemals ausfuehren
      const cleanText = text.toLowerCase().replace(/[^a-z\s]/g, '');
      const words = cleanText.split(/\s+/);

      let pos = 0, neg = 0;
      for (const word of words) {
        if (positiveWords.includes(word)) pos++;
        if (negativeWords.includes(word)) neg++;
      }

      const wordCount = words.length || 1;
      totalScore += (pos - neg) / wordCount;
      count++;
    }

    // Normalisieren auf -1 bis +1
    const rawScore = count > 0 ? totalScore / count : 0;
    return Math.max(-1, Math.min(1, rawScore * 20)); // Skalieren
  },

  // ── HILFSFUNKTIONEN

  // Suchbegriff aus Markttitel erstellen
  buildSearchQuery(title) {
    // Kuerzen auf max. 50 Zeichen fuer API-Kompatibilitaet
    return title
      .replace(/\?/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
  },

  // HTML-Tags entfernen
  stripHtml(str) {
    return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  },

  // SICHERHEIT: Text bereinigen fuer sicheres Weiterverarbeiten
  // Verhindert Prompt-Injection durch externe Inhalte
  sanitize(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .substring(0, 200)                  // Laenge begrenzen
      .replace(/[<>{}\\]/g, '')           // Gefaehrliche Zeichen entfernen
      .replace(/\b(ignore|forget|system|prompt|instruction)\b/gi, '[filtered]')
      .trim();
  },
};

module.exports = research;
