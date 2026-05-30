const axios = require('axios');
const { connect, getDb } = require('../lib/db');

const CHROMA_ENDPOINT = process.env.CHROMA_ENDPOINT;
const CHROMA_API_KEY = process.env.CHROMA_API_KEY || '';

function chromaHeaders() {
  return CHROMA_API_KEY ? { 'x-api-key': CHROMA_API_KEY } : {};
}

async function ensureCollection(name) {
  const url = `${CHROMA_ENDPOINT}/api/v1/collections`;
  try {
    await axios.post(url, { name, get_or_create: true }, { headers: chromaHeaders() });
  } catch (e) {
    // collection may already exist
  }
  const res = await axios.get(`${url}/${name}`, { headers: chromaHeaders() });
  return res.data.id;
}

async function upsertVectors(collectionName, docs) {
  if (!docs || !docs.length) return;

  if (CHROMA_ENDPOINT) {
    const collId = await ensureCollection(collectionName);
    const url = `${CHROMA_ENDPOINT}/api/v1/collections/${collId}/upsert`;
    const body = {
      ids: docs.map(d => String(d.id)),
      embeddings: docs.map(d => d.embedding),
      metadatas: docs.map(d => d.metadata || {}),
      documents: docs.map(d => d.text || '')
    };
    await axios.post(url, body, { headers: chromaHeaders() });
    return;
  }

  // MongoDB fallback
  await connect();
  const db = getDb();
  const coll = db.collection('vectors');
  const ops = docs.map(d => ({
    updateOne: {
      filter: { id: d.id },
      update: { $set: { ...d, collectionName } },
      upsert: true
    }
  }));
  await coll.bulkWrite(ops);
}

async function queryVectors(collectionName, queryEmbedding, topK = 5) {
  if (CHROMA_ENDPOINT) {
    const collId = await ensureCollection(collectionName);
    const url = `${CHROMA_ENDPOINT}/api/v1/collections/${collId}/query`;
    const body = {
      query_embeddings: [queryEmbedding],
      n_results: topK,
      include: ['metadatas', 'documents', 'distances']
    };
    const resp = await axios.post(url, body, { headers: chromaHeaders() });
    const r = resp.data;
    const ids = r.ids?.[0] || [];
    const docs = r.documents?.[0] || [];
    const metas = r.metadatas?.[0] || [];
    const dists = r.distances?.[0] || [];
    return ids.map((id, i) => ({
      id,
      score: 1 - (dists[i] || 0), // convert distance to similarity
      metadata: metas[i] || {},
      text: docs[i] || ''
    }));
  }

  // MongoDB cosine similarity fallback
  await connect();
  const db = getDb();
  const coll = db.collection('vectors');
  const all = await coll.find({ collectionName }).toArray();

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  return all
    .map(d => ({ id: d.id, score: cosine(queryEmbedding, d.embedding), metadata: d.metadata, text: d.text }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function deleteByDocument(collectionName, documentName) {
  if (CHROMA_ENDPOINT) {
    try {
      const collId = await ensureCollection(collectionName);
      const url = `${CHROMA_ENDPOINT}/api/v1/collections/${collId}/delete`;
      await axios.post(url, { where: { source: documentName } }, { headers: chromaHeaders() });
    } catch (e) { /* ignore */ }
    return;
  }
  await connect();
  const db = getDb();
  await db.collection('vectors').deleteMany({ collectionName, 'metadata.source': documentName });
}

module.exports = { upsertVectors, queryVectors, deleteByDocument };
