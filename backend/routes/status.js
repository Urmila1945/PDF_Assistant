const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { connect, getDb } = require('../lib/db');
    await connect();
    const db = getDb();

    const [stats, docs] = await Promise.all([
      db.collection('stats').findOne({ _id: 'global' }),
      db.collection('documents').find({}).sort({ uploadedAt: -1 }).toArray()
    ]);

    // Try queue stats if Redis/Bull available
    let queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0 };
    let recentJobs = [];
    try {
      const pdfQueue = require('../lib/queue');
      queueCounts = await pdfQueue.getJobCounts();
      const jobs = await pdfQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10, true);
      recentJobs = jobs.map(job => ({
        id: job.id,
        state: job.finishedOn ? 'completed' : job.failedReason ? 'failed' : job.processedOn ? 'active' : 'waiting',
        file: job.data?.originalName || 'unknown',
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason || null,
        timestamp: job.timestamp,
        finishedOn: job.finishedOn
      }));
    } catch (_) {}

    res.json({
      counts: queueCounts,
      recentJobs,
      stats: {
        totalDocs: stats?.totalDocs || docs.length,
        totalPages: stats?.totalPages || 0,
        totalChunks: stats?.totalChunks || 0,
        totalQuestions: stats?.totalQuestions || 0
      },
      documents: docs.map(d => ({
        name: d.name,
        pages: d.pages,
        chunks: d.chunks,
        uploadedAt: d.uploadedAt
      }))
    });
  } catch (err) {
    console.error('Status error:', err.message);
    res.json({ counts: {}, recentJobs: [], stats: {}, documents: [] });
  }
});

module.exports = router;
