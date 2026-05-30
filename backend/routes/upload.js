const express = require('express');
const multer = require('multer');
const path = require('path');
const { extractAndIndex } = require('../controllers/pdfProcessor');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    // Preserve original name (sanitized) for easy URL access
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.includes('pdf')) return cb(new Error('Only PDFs allowed'));
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

    // Always process synchronously (PROCESS_SYNC=true or default)
    // For large/scanned PDFs, use the worker instead
    if (process.env.PROCESS_SYNC !== 'false') {
      const results = await Promise.all(
        files.map(f => extractAndIndex(f.path, f.originalname).catch(err => ({
          document: f.originalname, error: err.message, pages: 0, chunks: 0
        })))
      );
      return res.json({ success: true, files: results });
    }

    // Queue mode
    const pdfQueue = require('../lib/queue');
    const jobs = [];
    for (const f of files) {
      try {
        const job = await pdfQueue.add(
          { filePath: f.path, originalName: f.originalname },
          { attempts: 3, backoff: 5000 }
        );
        jobs.push({ file: f.originalname, jobId: job.id });
      } catch (e) {
        jobs.push({ file: f.originalname, error: e.message });
      }
    }
    res.status(202).json({ success: true, queued: jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List uploaded documents from MongoDB
router.get('/documents', async (req, res) => {
  try {
    const { connect, getDb } = require('../lib/db');
    await connect();
    const db = getDb();
    const docs = await db.collection('documents').find({}).sort({ uploadedAt: -1 }).toArray();
    res.json({ documents: docs });
  } catch (e) {
    res.json({ documents: [] });
  }
});

// Delete a document
router.delete('/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const { connect, getDb } = require('../lib/db');
    const { deleteByDocument } = require('../services/vectorStore');
    const fs = require('fs');
    await connect();
    const db = getDb();

    // Delete from documents collection
    await db.collection('documents').deleteOne({ name });

    // Delete all vectors for this document
    await db.collection('vectors').deleteMany({ 'metadata.source': name });

    // Also try deleteByDocument for ChromaDB
    await deleteByDocument('ragnar_docs', name).catch(() => {});

    // Delete physical file
    const filePath = path.join(__dirname, '..', 'uploads', name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    console.log('Deleted document:', name);
    res.json({ success: true, deleted: name });
  } catch (e) {
    console.error('Delete error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
