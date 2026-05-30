const Queue = require('bull');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// PDF processing queue
const pdfQueue = new Queue('pdf-processing', redisUrl);

pdfQueue.on('error', (err) => console.error('PDF queue error', err));
pdfQueue.on('failed', (job, err) => console.warn('PDF job failed', job.id, err && err.message));

module.exports = pdfQueue;
