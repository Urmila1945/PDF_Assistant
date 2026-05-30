const express = require('express');
const { embedTexts } = require('../services/embeddings');
const { queryVectors } = require('../services/vectorStore');
const { chatWithLLM } = require('../services/llm');

const router = express.Router();

// Main RAG query
router.post('/', async (req, res) => {
  try {
    const { question, top_k = 8, model = 'gemini-flash', documents } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const [qEmbedding] = await embedTexts([question]);
    let matches = await queryVectors('ragnar_docs', qEmbedding, top_k);

    // Filter by specific documents if requested
    if (documents && documents.length > 0) {
      matches = matches.filter(m => documents.includes(m.metadata?.source));
    }

    if (!matches.length) {
      return res.json({ answer: 'No relevant content found in the uploaded documents. Please upload PDFs first.', sources: [], retrieved_count: 0 });
    }

    let context = '';
    const sources = [];
    for (const m of matches) {
      const src = m.metadata?.source || 'unknown';
      const page = m.metadata?.page || null;
      context += `[Source: ${src}${page ? `, Page ${page}` : ''}]\n${m.text}\n\n`;
      sources.push({
        document: src,
        page,
        score: Math.round((m.score || 0) * 100) / 100,
        text: m.text?.slice(0, 200)
      });
    }

    const systemPrompt = `You are an expert AI assistant that answers questions based strictly on the provided document context. 
Always cite your sources using the format: **Source: [DocumentName], Page [N]**
Be accurate, concise, and helpful. If the answer is not in the context, say so clearly.`;

    const userPrompt = `Context from uploaded documents:\n\n${context}\n\nQuestion: ${question}\n\nProvide a comprehensive answer with source citations.`;

    const answer = await chatWithLLM(systemPrompt, userPrompt, model);

    // Track question count and optionally save history
    try {
      const { connect, getDb } = require('../lib/db');
      await connect();
      const db = getDb();
      await db.collection('stats').updateOne({ _id: 'global' }, { $inc: { totalQuestions: 1 } }, { upsert: true });

      const saveHistory = req.body.saveHistory !== false; // defaults to true
      if (saveHistory) {
        await db.collection('chat_history').insertOne({
          question,
          answer,
          sources: sources.map(s => ({ document: s.document, page: s.page })),
          model,
          timestamp: new Date()
        });
      }
    } catch (_) {}

    res.json({ answer, sources, retrieved_count: matches.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Summarize a document
router.post('/summarize', async (req, res) => {
  try {
    const { documentName, type = 'short', model = 'gemini-flash' } = req.body;
    if (!documentName) return res.status(400).json({ error: 'documentName required' });

    const { connect, getDb } = require('../lib/db');
    await connect();
    const db = getDb();
    const vectors = await db.collection('vectors').find({ 'metadata.source': documentName }).limit(30).toArray();

    if (!vectors.length) return res.status(404).json({ error: 'Document not found or not indexed' });

    const context = vectors.map(v => v.text).join('\n\n');
    const typeMap = {
      short: 'Write a concise 2-3 sentence summary.',
      detailed: 'Write a detailed summary covering all main topics and key findings.',
      keypoints: 'Extract and list the 5-10 most important key points as bullet points.'
    };

    const answer = await chatWithLLM(
      'You are an expert document summarizer.',
      `Document: ${documentName}\n\nContent:\n${context}\n\n${typeMap[type] || typeMap.short}`,
      model
    );

    res.json({ summary: answer, documentName, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compare two documents
router.post('/compare', async (req, res) => {
  try {
    const { doc1, doc2, aspect = 'general', model = 'gemini-flash' } = req.body;
    if (!doc1 || !doc2) return res.status(400).json({ error: 'doc1 and doc2 required' });

    const { connect, getDb } = require('../lib/db');
    await connect();
    const db = getDb();

    const [v1, v2] = await Promise.all([
      db.collection('vectors').find({ 'metadata.source': doc1 }).limit(15).toArray(),
      db.collection('vectors').find({ 'metadata.source': doc2 }).limit(15).toArray()
    ]);

    const ctx1 = v1.map(v => v.text).join('\n\n');
    const ctx2 = v2.map(v => v.text).join('\n\n');

    const answer = await chatWithLLM(
      'You are an expert document analyst. Compare documents objectively.',
      `Document 1 (${doc1}):\n${ctx1}\n\nDocument 2 (${doc2}):\n${ctx2}\n\nProvide a structured comparison covering: similarities, differences, and key insights. Focus on: ${aspect}`,
      model
    );

    res.json({ comparison: answer, doc1, doc2 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keyword search across all documents
router.post('/search', async (req, res) => {
  try {
    const { keyword, documentName } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const { connect, getDb } = require('../lib/db');
    await connect();
    const db = getDb();

    const filter = { text: { $regex: keyword, $options: 'i' } };
    if (documentName) filter['metadata.source'] = documentName;

    const results = await db.collection('vectors').find(filter).limit(20).toArray();
    const hits = results.map(r => ({
      document: r.metadata?.source,
      page: r.metadata?.page,
      text: r.text,
      preview: highlightKeyword(r.text, keyword)
    }));

    res.json({ hits, count: hits.length, keyword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function highlightKeyword(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text.slice(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + keyword.length + 80);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

module.exports = router;
