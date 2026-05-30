const fs = require('fs');
const path = require('path');

async function extractAndIndex(filePath, originalName) {
  let pageTexts = [];

  // Step 1: Extract text with pdf-parse (no custom renderPage hook)
  try {
    const pdf = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const rawText = data.text || '';
    console.log(`[${originalName}] pdf-parse extracted ${rawText.length} chars, ${data.numpages} pages`);

    if (rawText.trim().length > 50) {
      // Split by form-feed (page breaks) or chunk by word count
      if (rawText.includes('\f')) {
        pageTexts = rawText.split('\f').map(t => t.trim()).filter(Boolean);
      } else {
        // Estimate pages: ~500 words per page
        const words = rawText.split(/\s+/).filter(Boolean);
        const wordsPerPage = Math.max(300, Math.floor(words.length / Math.max(data.numpages, 1)));
        for (let i = 0; i < words.length; i += wordsPerPage) {
          pageTexts.push(words.slice(i, i + wordsPerPage).join(' '));
        }
      }
    }
  } catch (e) {
    console.warn(`[${originalName}] pdf-parse failed:`, e.message);
  }

  // Step 2: OCR fallback if no text extracted
  if (!pageTexts.length || pageTexts.every(t => t.trim().length < 30)) {
    console.log(`[${originalName}] Trying OCR fallback...`);
    const ocrPages = await ocrFallback(filePath);
    if (ocrPages.length) pageTexts = ocrPages;
  }

  if (!pageTexts.length) {
    console.warn(`[${originalName}] No text extracted at all`);
    return { document: originalName, pages: 0, chunks: 0 };
  }

  // Step 3: Clean text
  pageTexts = pageTexts.map(t => cleanText(t)).filter(t => t.length > 20);
  console.log(`[${originalName}] ${pageTexts.length} pages with text`);

  // Step 4: Chunk with page metadata
  const chunks = [];
  for (let pi = 0; pi < pageTexts.length; pi++) {
    const pageChunks = chunkText(pageTexts[pi], 700, 150);
    pageChunks.forEach((text, ci) => chunks.push({ text, page: pi + 1, chunkIndex: ci }));
  }
  console.log(`[${originalName}] ${chunks.length} chunks created`);

  // Step 5: Embed and store
  try {
    const { embedTexts } = require('../services/embeddings');
    const { upsertVectors } = require('../services/vectorStore');
    const { connect, getDb } = require('../lib/db');

    const embeddings = await embedTexts(chunks.map(c => c.text));
    const docs = chunks.map((c, i) => ({
      id: `${originalName}-p${c.page}-c${c.chunkIndex}-${Date.now()}`,
      embedding: embeddings[i],
      text: c.text,
      metadata: { source: originalName, page: c.page, chunk: c.chunkIndex }
    }));

    await upsertVectors('ragnar_docs', docs);
    console.log(`[${originalName}] Stored ${docs.length} vectors`);

    await connect();
    const db = getDb();
    await db.collection('documents').updateOne(
      { name: originalName },
      { $set: { name: originalName, pages: pageTexts.length, chunks: chunks.length, uploadedAt: new Date(), filePath } },
      { upsert: true }
    );
    await db.collection('stats').updateOne(
      { _id: 'global' },
      { $inc: { totalChunks: chunks.length, totalPages: pageTexts.length, totalDocs: 1 } },
      { upsert: true }
    );
  } catch (e) {
    console.error(`[${originalName}] Embedding/storage failed:`, e.message);
    throw e;
  }

  return { document: originalName, pages: pageTexts.length, chunks: chunks.length };
}

async function ocrFallback(filePath) {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const os = require('os');
    const execAsync = util.promisify(exec);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfocr-'));
    const outPrefix = path.join(tmpDir, 'page');

    try {
      await execAsync(`pdftoppm -r 200 -png "${filePath}" "${outPrefix}"`, { windowsHide: true });
    } catch (e) {
      console.warn('pdftoppm unavailable:', e.message);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      return [];
    }

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort();
    if (!files.length) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {} return []; }

    try { require.resolve('tesseract.js'); } catch (_) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
      return [];
    }

    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng');
    const pageTexts = [];
    for (const f of files) {
      try {
        const { data: { text } } = await worker.recognize(path.join(tmpDir, f));
        pageTexts.push(text.trim());
      } catch (_) { pageTexts.push(''); }
    }
    await worker.terminate();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    return pageTexts;
  } catch (e) {
    console.warn('OCR fallback failed:', e.message);
    return [];
  }
}

function cleanText(text) {
  if (!text) return '';
  return text.normalize('NFKC')
    .replace(/\u00AD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function chunkText(text, targetTokens = 700, overlapTokens = 150) {
  if (!text || !text.trim()) return [];
  const targetWords = Math.floor(targetTokens * 0.75);
  const overlapWords = Math.floor(overlapTokens * 0.75);
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buffer = '';
  let bufferWords = 0;

  for (const p of paragraphs) {
    const pw = p.split(/\s+/).filter(Boolean).length;
    if (bufferWords + pw <= targetWords) {
      buffer += (buffer ? '\n\n' : '') + p;
      bufferWords += pw;
    } else {
      if (buffer) chunks.push(buffer);
      const words = (buffer + ' ' + p).trim().split(/\s+/).filter(Boolean);
      buffer = words.slice(Math.max(0, words.length - overlapWords)).join(' ');
      bufferWords = buffer.split(/\s+/).filter(Boolean).length;
    }
  }
  if (buffer.trim()) chunks.push(buffer);
  return chunks.length ? chunks : [text.slice(0, 3000)];
}

module.exports = { extractAndIndex, cleanText, chunkText };
