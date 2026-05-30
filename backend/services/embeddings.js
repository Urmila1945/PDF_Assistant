const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42S0xQVllid3EzbDk2NlVUYTl6bzVwZG5VZGlKaHhlTlN0ZG82aVdubnB2Rmc=', 'base64').toString();
const EMBED_MODEL = 'models/gemini-embedding-001';

async function embedTexts(texts = []) {
  if (!texts.length) return [];
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set in .env');

  // embedContent does not support batch — call sequentially in parallel (max 10 at a time)
  const results = [];
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(async (text) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;
      try {
        const resp = await axios.post(url, {
          model: EMBED_MODEL,
          content: { parts: [{ text: String(text) }] }
        });
        return resp.data.embedding.values;
      } catch (err) {
        if (err.response && err.response.status === 429) {
          throw new Error('Gemini API Rate Limit Exceeded (429). Please wait a minute and try again.');
        }
        throw err;
      }
    }));
    results.push(...embeddings);
  }
  return results;
}

module.exports = { embedTexts };
