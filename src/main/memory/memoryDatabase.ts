import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface MemoryDatabase {
  connection: Database.Database;
  close: () => void;
}

export function initializeMemoryDatabase(databasePath: string): MemoryDatabase {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath);
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL CHECK(length(trim(content)) > 0),
      category TEXT NOT NULL,
      importance TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_accessed_at TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      project_id TEXT,
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(archived);
    CREATE INDEX IF NOT EXISTS idx_memories_project_id ON memories(project_id);
    CREATE TABLE IF NOT EXISTS memory_candidates (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, category TEXT NOT NULL, importance TEXT NOT NULL,
      source TEXT NOT NULL, source_conversation_id TEXT, source_message_id TEXT, confidence REAL NOT NULL,
      reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CANDIDATE', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS communication_style_profiles (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, approval_state TEXT NOT NULL, formality TEXT NOT NULL,
      verbosity TEXT NOT NULL, punctuation_style TEXT NOT NULL, emoji_usage TEXT NOT NULL,
      greeting_style TEXT NOT NULL, closing_style TEXT NOT NULL, humor_level TEXT NOT NULL,
      common_expressions_json TEXT NOT NULL, contact_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      permission TEXT NOT NULL,
      state TEXT NOT NULL,
      scope TEXT,
      duration TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_permissions_type_scope ON permissions(permission, scope);
    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      resource TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
    CREATE TABLE IF NOT EXISTS companion_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_type TEXT NOT NULL,
      public_key TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      permissions_json TEXT NOT NULL,
      revoked_at TEXT
    );
  `);
  const migration = connection.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  migration.run(1, new Date().toISOString());
  migration.run(2, new Date().toISOString());
  return { connection, close: () => connection.close() };
}
