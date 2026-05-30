const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const MODEL_MAP = {
  'gemini-flash':   'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro'
};

async function chatWithLLM(systemPrompt, userPrompt, modelChoice = 'gemini-flash') {
  const model = MODEL_MAP[modelChoice] || MODEL_MAP['gemini-flash'];

  if (!GEMINI_KEY || GEMINI_KEY.includes('AQ.Ab8RN6')) {
      console.error('Invalid or revoked GEMINI_API_KEY');
      throw new Error('Your Gemini API key was revoked by GitHub/Google because it was leaked. Please update .env with a new Gemini key.');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const resp = await axios.post(url, {
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
  });
  return resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = { chatWithLLM };
