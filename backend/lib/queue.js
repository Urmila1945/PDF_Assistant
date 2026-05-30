const Queue = require('bull');

let pdfQueue;

if (process.env.PROCESS_SYNC === 'true') {
  console.log('Running in sync mode, mocking PDF queue (no Redis)');
  pdfQueue = {
    add: async (jobData) => { console.log('Mock sync queue processing:', jobData.originalName); return { id: Date.now() }; },
    getJobCounts: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 }),
    getJobs: async () => ([]),
    on: () => {},
    process: () => {}
  };
} else {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  pdfQueue = new Queue('pdf-processing', { 
      redis: redisUrl,
      settings: { maxStalledCount: 1 } 
  });
  
  pdfQueue.on('error', (err) => console.error('PDF queue error', err));
  pdfQueue.on('failed', (job, err) => console.warn('PDF job failed', job.id, err && err.message));
}

module.exports = pdfQueue;
