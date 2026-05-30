const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = 'models/gemini-embedding-001';

async function embedTexts(texts = []) {
  if (!texts.length) return [];

  // Try OpenAI first if Gemini key is revoked or missing
  if (OPENAI_KEY && (!GEMINI_KEY || GEMINI_KEY.includes('AQ.Ab8RN6'))) {
    const url = 'https://api.openai.com/v1/embeddings';
    const resp = await axios.post(url, {
      model: 'text-embedding-3-small',
      input: texts.map(String),
      dimensions: 768 // Keep 768 to match Gemini dimension in MongoDB vector search index
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
    });
    return resp.data.data.map(d => d.embedding);
  }

  // Fallback to Gemini
  if (!GEMINI_KEY) throw new Error('Neither OPENAI_API_KEY nor GEMINI_API_KEY is set in .env');

  const results = [];
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(async (text) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;
      const resp = await axios.post(url, {
        model: EMBED_MODEL,
        content: { parts: [{ text: String(text) }] }
      });
      return resp.data.embedding.values;
    }));
    results.push(...embeddings);
  }
  return results;
}

module.exports = { embedTexts };
