const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const MODEL_MAP = {
  'gemini-flash':   'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gpt-4o-mini':    'gpt-4o-mini',
  'gpt-4o':         'gpt-4o'
};

async function chatWithLLM(systemPrompt, userPrompt, modelChoice = 'gemini-flash') {
  const model = MODEL_MAP[modelChoice] || MODEL_MAP['gemini-flash'];

  if (model.startsWith('gpt')) {
    if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in .env');
    const url = 'https://api.openai.com/v1/chat/completions';
    const resp = await axios.post(url, {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2048,
      temperature: 0.2
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
    });
    return resp.data.choices[0].message.content || '';
  } else {
    if (!GEMINI_KEY || GEMINI_KEY.includes('AQ.Ab8RN6')) {
        console.error('Invalid or revoked GEMINI_API_KEY');
        throw new Error('Your Gemini API key was revoked by GitHub/Google because it was leaked. Please select an OpenAI model from the chat or update .env with a new Gemini key.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const resp = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
    });
    return resp.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

module.exports = { chatWithLLM };
