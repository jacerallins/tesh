import type { Memory, ListMemoriesOptions, SearchMemoriesOptions } from '../../shared/memoryTypes';
import type Database from 'better-sqlite3';

interface MemoryRow {
  id: string; content: string; category: Memory['category']; importance: Memory['importance']; source: Memory['source'];
  created_at: string; updated_at: string; last_accessed_at: string | null; tags_json: string;
  project_id: string | null; archived: number; metadata_json: string;
}

function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id, content: row.content, category: row.category, importance: row.importance, source: row.source,
    createdAt: row.created_at, updatedAt: row.updated_at, lastAccessedAt: row.last_accessed_at ?? undefined,
    tags: JSON.parse(row.tags_json) as string[], projectId: row.project_id ?? undefined,
    archived: row.archived === 1, metadata: JSON.parse(row.metadata_json) as Record<string, string>
  };
}

const selectColumns = 'id, content, category, importance, source, created_at, updated_at, last_accessed_at, tags_json, project_id, archived, metadata_json';

export class MemoryRepository {
  constructor(private readonly database: Database.Database) {}

  insert(memory: Memory): Memory { this.database.prepare(`INSERT INTO memories (${selectColumns.replaceAll(', ', ', ')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(memory.id, memory.content, memory.category, memory.importance, memory.source, memory.createdAt, memory.updatedAt, memory.lastAccessedAt ?? null, JSON.stringify(memory.tags), memory.projectId ?? null, memory.archived ? 1 : 0, JSON.stringify(memory.metadata)); return memory; }
  findById(id: string): Memory | null { const row = this.database.prepare(`SELECT ${selectColumns} FROM memories WHERE id = ?`).get(id) as MemoryRow | undefined; return row ? mapMemory(row) : null; }
  update(id: string, fields: Partial<Memory>): Memory | null {
    const existing = this.findById(id); if (!existing) return null;
    const next = { ...existing, ...fields, id, updatedAt: new Date().toISOString() };
    this.database.prepare(`UPDATE memories SET content = ?, category = ?, importance = ?, source = ?, updated_at = ?, last_accessed_at = ?, tags_json = ?, project_id = ?, archived = ?, metadata_json = ? WHERE id = ?`).run(next.content, next.category, next.importance, next.source, next.updatedAt, next.lastAccessedAt ?? null, JSON.stringify(next.tags), next.projectId ?? null, next.archived ? 1 : 0, JSON.stringify(next.metadata), id);
    return next;
  }
  remove(id: string): boolean { return this.database.prepare('DELETE FROM memories WHERE id = ?').run(id).changes === 1; }
  list(options: ListMemoriesOptions = {}): Memory[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200); const offset = Math.max(options.offset ?? 0, 0);
    const archivedClause = options.includeArchived ? '' : 'WHERE archived = 0';
    return (this.database.prepare(`SELECT ${selectColumns} FROM memories ${archivedClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(limit, offset) as MemoryRow[]).map(mapMemory);
  }
  search(options: SearchMemoriesOptions): Memory[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200); const offset = Math.max(options.offset ?? 0, 0); const term = `%${options.query.trim()}%`;
    const archivedClause = options.includeArchived ? '' : 'AND archived = 0';
    return (this.database.prepare(`SELECT ${selectColumns} FROM memories WHERE (content LIKE ? OR tags_json LIKE ? OR project_id LIKE ?) ${archivedClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(term, term, term, limit, offset) as MemoryRow[]).map(mapMemory);
  }
}
