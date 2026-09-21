import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

const { aiEnabled, generateQuiz } = await import('./quiz.js');
const { saveSession, listSessions, storageKind } = await import('./store.js');
const { upload, extractFile, youtubeToText } = await import('./extract.js');
const { linkToText } = await import('./webpage.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '300kb' }));

// Small in-memory limiter per IP. Enough to protect the API key in a demo deployment.
function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: 'Too many requests. Wait a few minutes and try again.' });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}

const CLIENT_ID = /^[a-zA-Z0-9-]{8,64}$/;
function requireClient(req, res, next) {
  const id = req.get('x-client-id');
  if (!id || !CLIENT_ID.test(id)) return res.status(400).json({ error: 'Missing or invalid x-client-id header' });
  req.clientId = id;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: aiEnabled(), storage: storageKind() });
});

app.post('/api/quiz', limiter(40, 10 * 60 * 1000), async (req, res) => {
  const { text, tier } = req.body || {};
  if (typeof text !== 'string' || text.trim().length < 30 || text.length > 4000) {
    return res.status(400).json({ error: 'text must be a string of 30 to 4000 characters' });
  }
  if (tier !== 'recall' && tier !== 'concept') {
    return res.status(400).json({ error: 'tier must be "recall" or "concept"' });
  }
  if (!aiEnabled()) return res.status(503).json({ error: 'AI questions are not configured', fallback: true });
  try {
    res.json(await generateQuiz(text.trim(), tier));
  } catch (err) {
    console.error('quiz generation failed:', err.message);
    res.status(502).json({ error: 'Quiz generation failed', fallback: true });
  }
});

app.post('/api/sessions', requireClient, limiter(60, 10 * 60 * 1000), async (req, res) => {
  const summary = req.body;
  const ok =
    summary &&
    typeof summary === 'object' &&
    Number.isFinite(summary.focusScore) &&
    Number.isFinite(summary.totalMs) &&
    Array.isArray(summary.chunks);
  if (!ok) return res.status(400).json({ error: 'Invalid session summary' });
  try {
    res.status(201).json(await saveSession(req.clientId, summary));
  } catch (err) {
    console.error('save failed:', err.message);
    res.status(500).json({ error: 'Could not save session' });
  }
});

app.get('/api/sessions', requireClient, async (req, res) => {
  try {
    res.json(await listSessions(req.clientId));
  } catch (err) {
    console.error('list failed:', err.message);
    res.status(500).json({ error: 'Could not load sessions' });
  }
});

app.post(
  '/api/extract',
  limiter(30, 10 * 60 * 1000),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'File is over 10 MB.' : 'Upload failed.' });
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
    try {
      res.json(await extractFile(req.file));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not read that file.' });
    }
  }
);

app.get('/api/youtube', limiter(20, 10 * 60 * 1000), async (req, res) => {
  try {
    res.json(await youtubeToText(String(req.query.url || '')));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.status ? err.message : 'Could not fetch the transcript.' });
  }
});

// Serve the built client in production (npm start).
const dist = path.join(here, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`FocusQuiz server on http://localhost:${port}`);
  console.log(`  AI questions: ${aiEnabled() ? 'on' : 'off (add ANTHROPIC_API_KEY to enable)'}`);
  console.log(`  Storage:      ${storageKind()}`);
});
