import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsBase = path.join(__dirname, '..', '..', 'uploads');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Extract a {x, y, w, h} bbox from any annotation data format.
 * Handles: {x1,y1,x2,y2}, {x,y,w,h}, {bbox:{x,y,w,h}}, polygon arrays, {polygon:[[x,y],...]}.
 */
function extractAnnotationGeometry(a) {
  let parsed;
  try {
    parsed = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
  } catch {
    console.warn(`[quality-review] Unparseable annotation data for ${a.id}`);
    return { bbox: null, polygon: null };
  }

  let bbox = null;
  let polygon = null;

  // bbox type: {x1, y1, x2, y2}
  if (a.type === 'bbox' && parsed && parsed.x1 != null) {
    bbox = { x: parsed.x1, y: parsed.y1, w: parsed.x2 - parsed.x1, h: parsed.y2 - parsed.y1 };
  }
  // AI bbox: {x, y, w, h} at top level
  else if (parsed && parsed.x != null && parsed.y != null && parsed.w != null && parsed.h != null) {
    bbox = { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };
  }
  // Nested AI format: {bbox: {x, y, w, h}}
  else if (parsed && typeof parsed.bbox === 'object' && parsed.bbox !== null &&
           parsed.bbox.x != null && parsed.bbox.w != null) {
    bbox = { x: parsed.bbox.x, y: parsed.bbox.y, w: parsed.bbox.w, h: parsed.bbox.h };
  }
  // polygon: {polygon: [[x,y],...]} (wrapped)
  else if (parsed && parsed.polygon && Array.isArray(parsed.polygon)) {
    polygon = parsed.polygon;
  }
  // Direct polygon: [[x,y],...] or [[[x,y],...]]
  else if (Array.isArray(parsed) && parsed.length > 0) {
    const flat = Array.isArray(parsed[0]?.[0]) ? parsed[0] : parsed;
    polygon = flat;
  }

  // Derive bbox from polygon if we don't have one yet
  if (!bbox && polygon && polygon.length > 0) {
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);
    bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  if (!bbox && !polygon) {
    console.warn(`[quality-review] Could not extract geometry for annotation ${a.id}, type=${a.type}`);
  }

  return { bbox, polygon };
}

const router = Router();

/**
 * Helper: look up an image by ID, return its file path and metadata.
 */
function getImageFile(imageId) {
  const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId);
  if (!image) return null;
  const filePath = path.join(uploadsBase, image.project_id, image.filename);
  if (!fs.existsSync(filePath)) return null;
  return { image, filePath };
}

/**
 * Helper: proxy a JSON request body to the AI service.
 */
async function proxyJson(endpoint, body) {
  const resp = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI service error (${resp.status}): ${text}`);
  }
  return resp.json();
}

/**
 * Helper: proxy a request with an image file as multipart form data.
 * Reads the image from disk by image_id and forwards it along with other fields.
 */
async function proxyWithImage(endpoint, imageId, extraFields = {}) {
  const imageFile = getImageFile(imageId);
  if (!imageFile) {
    throw new Error('Image not found');
  }

  const { Blob } = await import('buffer');
  const fileBuffer = fs.readFileSync(imageFile.filePath);
  const ext = path.extname(imageFile.image.filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('image', blob, imageFile.image.filename);

  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined && value !== null) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  const resp = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI service error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// POST /api/ai/segment/click
router.post('/segment/click', async (req, res, next) => {
  try {
    const { image_id, points, labels } = req.body;
    const result = await proxyWithImage('/segment/click', image_id, { points, labels });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/segment/box
router.post('/segment/box', async (req, res, next) => {
  try {
    const { image_id, box } = req.body;
    const result = await proxyWithImage('/segment/box', image_id, { box });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/segment/everything
router.post('/segment/everything', async (req, res, next) => {
  try {
    const { image_id, params } = req.body;
    const result = await proxyWithImage('/segment/everything', image_id, params || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/segment/refine
router.post('/segment/refine', async (req, res, next) => {
  try {
    const { image_id, mask_rle, positive_points, negative_points } = req.body;
    const result = await proxyWithImage('/segment/refine', image_id, { mask_rle, positive_points, negative_points });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/clip/classify
router.post('/clip/classify', async (req, res, next) => {
  try {
    const { image_id, labels: classLabels } = req.body;
    const result = await proxyWithImage('/clip/classify', image_id, { labels: classLabels });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/clip/embed
router.post('/clip/embed', async (req, res, next) => {
  try {
    const { image_id } = req.body;
    const result = await proxyWithImage('/clip/embed', image_id);

    // Save embedding to the image record
    if (result.embedding) {
      db.prepare('UPDATE images SET clip_embedding = ? WHERE id = ?')
        .run(JSON.stringify(result.embedding), image_id);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/clip/search
router.post('/clip/search', async (req, res, next) => {
  try {
    const { project_id, query } = req.body;

    // Get all images with embeddings for this project
    const images = db.prepare(
      'SELECT id, filename, clip_embedding FROM images WHERE project_id = ? AND clip_embedding IS NOT NULL'
    ).all(project_id);

    const embeddings = images.map((img) => ({
      image_id: img.id,
      embedding: JSON.parse(img.clip_embedding),
    }));

    const result = await proxyJson('/clip/search', { query, embeddings });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/chat — Ollama-powered tool-calling agent
router.post('/agent/chat', async (req, res, next) => {
  try {
    const { image_id, project_id, message, history } = req.body;

    if (!image_id || !message) {
      return res.status(400).json({ error: 'image_id and message are required' });
    }

    // Build context from DB
    const annotations = db.prepare(
      'SELECT id, label, type, data, confidence, source FROM annotations WHERE image_id = ?'
    ).all(image_id);

    const labelClasses = db.prepare(
      'SELECT name, color FROM label_classes WHERE project_id = ?'
    ).all(project_id || '');

    const imageCount = project_id
      ? db.prepare('SELECT COUNT(*) as count FROM images WHERE project_id = ?').get(project_id).count
      : 0;

    const context = { annotations, labelClasses, imageCount };

    // Proxy to AI service
    const result = await proxyWithImage('/agent/chat', image_id, {
      message,
      context: JSON.stringify(context),
      history: JSON.stringify(history || []),
    });

    // Execute returned actions on the DB
    if (result.actions && Array.isArray(result.actions)) {
      for (const action of result.actions) {
        if (action.action === 'remove') {
          db.prepare('DELETE FROM annotations WHERE image_id = ? AND label = ?')
            .run(image_id, action.label);
        } else if (action.action === 'relabel') {
          db.prepare('UPDATE annotations SET label = ? WHERE image_id = ? AND label = ?')
            .run(action.new_label, image_id, action.old_label);
        }
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/nl-annotate — natural language annotation
router.post('/agent/nl-annotate', async (req, res, next) => {
  try {
    const { image_id, project_id, prompt } = req.body;
    const result = await proxyWithImage('/agent/nl-annotate', image_id, { prompt });

    // Auto-create annotations from results
    if (result.annotations && Array.isArray(result.annotations)) {
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO annotations (id, image_id, project_id, label, type, data, confidence, source, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAll = db.transaction((annotations) => {
        for (const ann of annotations) {
          const id = uuidv4();
          insertStmt.run(
            id,
            image_id,
            project_id,
            ann.label || null,
            ann.type || 'polygon',
            typeof ann.data === 'string' ? ann.data : JSON.stringify(ann.data),
            ann.confidence ?? null,
            'nl-agent',
            req.user || 'local-user',
            now,
            now
          );
        }
      });

      insertAll(result.annotations);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/quality-review — review ALL images in a project
// DELETE /api/ai/agent/quality-review — clear all review issues for a project
router.delete('/agent/quality-review', (req, res, next) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });
    db.prepare('DELETE FROM review_issues WHERE project_id = ?').run(project_id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/quality-review/image — review a single image (used for per-image progress)
router.post('/agent/quality-review/image', async (req, res, next) => {
  try {
    const { image_id, project_id, project_labels } = req.body;
    if (!image_id || !project_id) {
      return res.status(400).json({ error: 'image_id and project_id are required' });
    }

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(image_id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const rawAnnotations = db.prepare('SELECT * FROM annotations WHERE image_id = ?').all(image_id);
    const annotations = rawAnnotations.map((a) => {
      const { bbox, polygon } = extractAnnotationGeometry(a);
      return { id: a.id, label: a.label, type: a.type, bbox, polygon };
    });

    const result = await proxyWithImage('/agent/quality-review', image_id, {
      annotations,
      project_labels: project_labels || [],
    });

    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO review_issues (id, project_id, image_id, annotation_id, type, severity, message, suggestion, bbox, predicted_label, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `);

    if (result.issues && Array.isArray(result.issues)) {
      for (const issue of result.issues) {
        insertStmt.run(
          uuidv4(), project_id, image_id,
          issue.annotation_id || null, issue.type || null,
          ({ high: 'error', medium: 'warning', low: 'info' }[issue.severity]) || 'warning',
          issue.message, issue.suggestion || null,
          issue.bbox ? JSON.stringify(issue.bbox) : null,
          issue.predicted_label || null, now
        );
      }
    }

    const enrichedIssues = (result.issues || []).map((issue) => ({
      ...issue,
      image_id: image.id,
      image_filename: image.original_name || image.filename,
    }));

    res.json({ issues: enrichedIssues });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/quality-review — review ALL images in a project
router.post('/agent/quality-review', async (req, res, next) => {
  try {
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Get all images in the project
    const images = db.prepare('SELECT * FROM images WHERE project_id = ?').all(project_id);

    // Get project label classes
    const labelClasses = db.prepare('SELECT name FROM label_classes WHERE project_id = ?').all(project_id);
    const projectLabels = labelClasses.map((lc) => lc.name);

    // Clear old issues for entire project
    db.prepare('DELETE FROM review_issues WHERE project_id = ?').run(project_id);

    const allIssues = [];
    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO review_issues (id, project_id, image_id, annotation_id, type, severity, message, suggestion, bbox, predicted_label, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `);

    for (const image of images) {
      // Get annotations for this image
      const rawAnnotations = db.prepare(
        'SELECT * FROM annotations WHERE image_id = ?'
      ).all(image.id);

      const annotations = rawAnnotations.map((a) => {
        const { bbox, polygon } = extractAnnotationGeometry(a);
        return { id: a.id, label: a.label, type: a.type, bbox, polygon };
      });

      let result;
      try {
        result = await proxyWithImage('/agent/quality-review', image.id, {
          annotations,
          project_labels: projectLabels,
        });
      } catch (err) {
        console.error(`Quality review failed for image ${image.id}:`, err.message);
        continue;
      }

      if (result.issues && Array.isArray(result.issues)) {
        for (const issue of result.issues) {
          const enriched = {
            ...issue,
            image_id: image.id,
            image_filename: image.original_name || image.filename,
          };
          allIssues.push(enriched);

          insertStmt.run(
            uuidv4(),
            project_id,
            image.id,
            issue.annotation_id || null,
            issue.type || null,
            ({ high: 'error', medium: 'warning', low: 'info' }[issue.severity]) || 'warning',
            issue.message,
            issue.suggestion || null,
            issue.bbox ? JSON.stringify(issue.bbox) : null,
            issue.predicted_label || null,
            now
          );
        }
      }
    }

    const nMismatch = allIssues.filter((i) => i.type === 'label_mismatch').length;
    const nMissing = allIssues.filter((i) => i.type === 'missing_annotation').length;
    const summary = `Reviewed ${images.length} image(s): found ${nMismatch} label mismatch(es) and ${nMissing} possible missing annotation(s).`;

    res.json({ issues: allIssues, summary, images_reviewed: images.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/agent/dataset-health — compute dataset health stats
router.post('/agent/dataset-health', async (req, res, next) => {
  try {
    const { project_id } = req.body;

    // Compute stats from DB
    const imageCount = db.prepare(
      'SELECT COUNT(*) AS count FROM images WHERE project_id = ?'
    ).get(project_id).count;

    const annotationCount = db.prepare(
      'SELECT COUNT(*) AS count FROM annotations WHERE project_id = ?'
    ).get(project_id).count;

    const labelDistribution = db.prepare(`
      SELECT label, COUNT(*) AS count
      FROM annotations WHERE project_id = ?
      GROUP BY label
    `).all(project_id);

    const sourceDistribution = db.prepare(`
      SELECT source, COUNT(*) AS count
      FROM annotations WHERE project_id = ?
      GROUP BY source
    `).all(project_id);

    const unannotatedImages = db.prepare(`
      SELECT COUNT(*) AS count FROM images
      WHERE project_id = ? AND id NOT IN (SELECT DISTINCT image_id FROM annotations WHERE project_id = ?)
    `).get(project_id, project_id).count;

    const openIssues = db.prepare(
      "SELECT COUNT(*) AS count FROM review_issues WHERE project_id = ? AND status = 'open'"
    ).get(project_id).count;

    const dbStats = {
      image_count: imageCount,
      annotation_count: annotationCount,
      label_distribution: labelDistribution,
      source_distribution: sourceDistribution,
      unannotated_images: unannotatedImages,
      open_issues: openIssues,
      avg_annotations_per_image: imageCount > 0 ? +(annotationCount / imageCount).toFixed(2) : 0,
    };

    // Try to get CLIP-based diversity stats from AI service
    try {
      const images = db.prepare(
        'SELECT id, clip_embedding FROM images WHERE project_id = ? AND clip_embedding IS NOT NULL'
      ).all(project_id);

      if (images.length > 0) {
        const embeddings = images.map((img) => ({
          image_id: img.id,
          embedding: JSON.parse(img.clip_embedding),
        }));
        const clipStats = await proxyJson('/agent/dataset-health', { embeddings });
        Object.assign(dbStats, { clip_analysis: clipStats });
      }
    } catch {
      // AI service may not be available, that's OK
    }

    res.json(dbStats);
  } catch (err) {
    next(err);
  }
});

export default router;
