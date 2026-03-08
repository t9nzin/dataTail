import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { setupWebSocket } from './websocket.js';
import projectsRouter from './routes/projects.js';
import imagesRouter from './routes/images.js';
import annotationsRouter from './routes/annotations.js';
import labelsRouter from './routes/labels.js';
import aiRouter from './routes/ai.js';
import reviewsRouter from './routes/reviews.js';
import tailnetRouter from './routes/tailnet.js';
import exportRouter from './routes/export.js';

// Ensure db is initialized (tables created on import)
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow localhost origins
app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.ts\.net(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.options('*', cors());

app.use((req, res, next) => {
  console.log("HEADERS:", req.headers);
  next();
});

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Middleware: extract Tailscale user identity
app.use((req, res, next) => {
  req.user = req.headers['tailscale-user-login']
    || req.headers['x-webauth-user']
    || 'local-user';
  req.userDisplayName = req.headers['tailscale-user-name'] || '';
  req.userProfilePic = req.headers['tailscale-user-profile-pic'] || '';
  req.userTailnet = req.headers['tailscale-tailnet'] || '';
  next();
});

// Mount routes
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/images', imagesRouter);
app.use('/api/annotations', annotationsRouter);
app.use('/api/projects/:projectId/labels', labelsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/tailnet', tailnetRouter);
app.use('/api/projects/:projectId/export', exportRouter);

// GET /api/images/:imageId — fetch single image by ID (project-agnostic)
app.get('/api/images/:imageId', (req, res) => {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
  if (!image) return res.status(404).json({ error: 'Image not found' });
  res.json(image);
});

// GET /api/images/:imageId/file — serve the actual image file
app.get('/api/images/:imageId/file', (req, res) => {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
  if (!image) return res.status(404).json({ error: 'Image not found' });
  const filePath = path.join(__dirname, '..', 'uploads', image.project_id, image.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// PATCH /api/images/:imageId/status — update image status (pending/done)
app.patch('/api/images/:imageId/status', (req, res) => {
  const { status } = req.body;
  if (!status || !['pending', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "pending" or "done"' });
  }
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
  if (!image) return res.status(404).json({ error: 'Image not found' });
  db.prepare('UPDATE images SET status = ? WHERE id = ?').run(status, req.params.imageId);
  res.json({ ...image, status });
});

// DELETE /api/images/:imageId — delete image by ID (project-agnostic)
app.delete('/api/images/:imageId', (req, res) => {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.imageId);
  if (!image) return res.status(404).json({ error: 'Image not found' });
  const filePath = path.join(__dirname, '..', 'uploads', image.project_id, image.filename);
  try { fs.unlinkSync(filePath); } catch { }
  db.prepare('DELETE FROM images WHERE id = ?').run(req.params.imageId);
  res.json({ success: true });
});

// GET /api/me — current user identity + admin status
const TAILNET_SERVICE_URL = process.env.TAILNET_SERVICE_URL || 'http://127.0.0.1:4000';

app.get('/api/me', async (req, res) => {
  const login = req.user;
  const displayName = req.userDisplayName;
  const profilePicUrl = req.userProfilePic;
  const tailnet = req.userTailnet;
  let isAdmin = false;
  let tailnetServiceAvailable = false;
  try {
    const r = await fetch(
      `${TAILNET_SERVICE_URL}/internal/check-admin/${encodeURIComponent(login)}`
    );
    if (r.ok) {
      const data = await r.json();
      isAdmin = data.isAdmin === true;
      tailnetServiceAvailable = true;
    }
  } catch {
    // tailscale-admin service not running — fail closed
  }
  res.json({ user: login, login, displayName, profilePicUrl, tailnet, isAdmin, tailnetServiceAvailable });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', user: req.user });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dataTail server listening on http://127.0.0.1:${PORT}`);
});

export default app;
