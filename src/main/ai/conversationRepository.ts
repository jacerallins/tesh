import type Database from 'better-sqlite3';
import type { ConversationSnapshot } from '../../shared/aiTypes';

export class ConversationRepository {
  constructor(private readonly db: Database.Database) { this.db.exec('CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, snapshot_json TEXT NOT NULL)'); this.db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC)'); }
  save(snapshot: ConversationSnapshot): void { const now = new Date().toISOString(); this.db.prepare('INSERT INTO conversations (id, created_at, updated_at, snapshot_json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, snapshot_json=excluded.snapshot_json').run(snapshot.id, now, now, JSON.stringify(snapshot)); }
  get(id: string): ConversationSnapshot | null { const row = this.db.prepare('SELECT snapshot_json FROM conversations WHERE id=?').get(id) as { snapshot_json?: string } | undefined; return row?.snapshot_json ? JSON.parse(row.snapshot_json) as ConversationSnapshot : null; }
  list(limit = 50): ConversationSnapshot[] { const rows = this.db.prepare('SELECT snapshot_json FROM conversations ORDER BY updated_at DESC LIMIT ?').all(Math.min(Math.max(limit, 1), 100)) as Array<{ snapshot_json: string }>; return rows.map(row => JSON.parse(row.snapshot_json) as ConversationSnapshot); }
}
