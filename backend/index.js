require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const uploadRoute = require('./routes/upload');
const queryRoute = require('./routes/query');
const statusRoute = require('./routes/status');
const { connect } = require('./lib/db');

const app = express();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*' }));
app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

app.use(express.json({ limit: '10mb' }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded PDFs
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/upload', uploadRoute);
app.use('/api/query', queryRoute);
app.use('/api/status', statusRoute);

app.get('/', (req, res) => res.send('BrainHeaters API is running 🚀'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.warn('⚠️  MongoDB connection failed:', err.message, '— starting anyway');
    app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT} (DB offline)`));
  });
