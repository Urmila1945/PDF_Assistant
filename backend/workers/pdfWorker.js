const path = require('path');
const pdfQueue = require('../lib/queue');
const { extractAndIndex } = require('../controllers/pdfProcessor');

// Start processing jobs (this file can be launched as a separate worker process)
pdfQueue.process(async (job) => {
  const { filePath, originalName } = job.data || {};
  if (!filePath) throw new Error('Missing filePath in job data');
  try {
    const result = await extractAndIndex(filePath, originalName || path.basename(filePath));
    return { success: true, result };
  } catch (e) {
    console.error('Worker failed processing', filePath, e.message);
    throw e;
  }
});

pdfQueue.on('completed', (job, result) => {
  console.log('PDF job completed', job.id, result && result.result ? result.result : result);
});

module.exports = pdfQueue;
