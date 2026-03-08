import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'datatail.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    clip_embedding TEXT,
    uploaded_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    label TEXT,
    type TEXT NOT NULL CHECK(type IN ('polygon', 'bbox', 'mask')),
    data TEXT NOT NULL,
    confidence REAL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'sam-click', 'sam-box', 'sam-auto', 'nl-agent', 'ai-segment')),
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS label_classes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS review_issues (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    annotation_id TEXT,
    type TEXT,
    severity TEXT NOT NULL CHECK(severity IN ('error', 'warning', 'info')),
    message TEXT NOT NULL,
    suggestion TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'accepted', 'dismissed')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    login TEXT PRIMARY KEY,
    role TEXT NOT NULL
  );

`);

// Migration: add status column to images table
try {
  db.exec(`ALTER TABLE images ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
} catch {
  // Column already exists
}

// Migration: add created_by column to projects table
try {
  db.exec(`ALTER TABLE projects ADD COLUMN created_by TEXT`);
} catch {
  // Column already exists
}
// Migration: add bbox and predicted_label columns to review_issues table
try {
  db.exec(`ALTER TABLE review_issues ADD COLUMN bbox TEXT`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE review_issues ADD COLUMN predicted_label TEXT`);
} catch {
  // Column already exists
}

export default db;
