const express = require('express');
const mongoose = require('mongoose');
const os = require('os');

const app = express();
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/notepad';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => { console.error('❌ MongoDB connection error:', err); process.exit(1); });

// ─── Note Schema ──────────────────────────────────────────────────────────────
const noteSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  content:   { type: String, required: true },
  createdAt: { type: Date,   default: Date.now },
});

const Note = mongoose.model('Note', noteSchema);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    instance: os.hostname(),   
    timestamp: new Date().toISOString(),
  });
});


app.post('/notes', async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '`title` and `content` are required.' });
    }

    const note = await Note.create({ title, content });

    res.status(201).json({
      message: 'Note saved.',
      note,
      servedBy: os.hostname(),  
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });

    res.json({
      count: notes.length,
      notes,
      servedBy: os.hostname(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/notes/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found.' });

    res.json({ note, servedBy: os.hostname() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Notepad API running on port ${PORT} | host: ${os.hostname()}`);
});