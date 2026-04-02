const express = require('express');
const mongoose = require('mongoose');
const os = require('os');

const app = express();
app.use(express.json());

// ─── Validate Environment Variables ───────────────────────────────────────────
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in environment variables');
  process.exit(1);
}

if (!process.env.PORT) {
  console.warn('⚠️  PORT is not defined, defaulting to 3000');
}

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Log if MongoDB disconnects after initial connection
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// ─── Note Schema ──────────────────────────────────────────────────────────────
const noteSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true, maxlength: 200 },
  content:   { type: String, required: true, trim: true, maxlength: 10000 },
  createdAt: { type: Date,   default: Date.now },
});

const Note = mongoose.model('Note', noteSchema);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  // If DB is down, return 503 so ALB marks instance as unhealthy
  if (dbStatus === 'disconnected') {
    return res.status(503).json({
      status: 'unhealthy',
      database: dbStatus,
      instance: os.hostname(),
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    instance: os.hostname(),
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /notes ──────────────────────────────────────────────────────────────
app.post('/notes', async (req, res) => {
  try {
    const { title, content } = req.body;

    // Check body is not empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Request body is empty.' });
    }

    // Check required fields
    if (!title || !content) {
      return res.status(400).json({ error: '`title` and `content` are required.' });
    }

    // Check they are strings
    if (typeof title !== 'string' || typeof content !== 'string') {
      return res.status(400).json({ error: '`title` and `content` must be strings.' });
    }

    const note = await Note.create({ title, content });

    res.status(201).json({
      message: 'Note saved.',
      note,
      servedBy: os.hostname(),
    });

  } catch (err) {
    // Mongoose validation error (e.g. maxlength exceeded)
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('❌ POST /notes error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /notes ───────────────────────────────────────────────────────────────
app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });

    res.json({
      count: notes.length,
      notes,
      servedBy: os.hostname(),
    });

  } catch (err) {
    console.error('❌ GET /notes error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /notes/:id ───────────────────────────────────────────────────────────
app.get('/notes/:id', async (req, res) => {
  try {
    // Check if ID format is valid before hitting the DB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid note ID format.' });
    }

    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    res.json({ note, servedBy: os.hostname() });

  } catch (err) {
    console.error('❌ GET /notes/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── Non-blocking CPU Burn ────────────────────────────────────────────────────
app.get('/burn', (req, res) => {
  const duration = parseInt(req.query.duration) || 1000;
  const start = Date.now();
  let result = 0;

  // Use setImmediate to yield to event loop periodically
  // This lets health checks through while still burning CPU
  const burn = () => {
    const chunk = Date.now();
    while (Date.now() - chunk < 100) {
      result += Math.sqrt(Math.random()) * Math.tan(Math.random());
      result += Math.pow(Math.random(), Math.random());
    }

    if (Date.now() - start < duration) {
      setImmediate(burn); // yield to event loop → health checks can pass ✅
    } else {
      res.json({
        message: '🔥 CPU burn complete',
        durationMs: Date.now() - start,
        result,
        servedBy: os.hostname(),
      });
    }
  };

  burn();
});

// ─── 404 Handler (unknown routes) ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong.' });
});

// ─── Handle uncaught exceptions & rejections ──────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Notepad API running on port ${PORT} | host: ${os.hostname()}`);
});

