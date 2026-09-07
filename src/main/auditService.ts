import type Database from 'better-sqlite3';
import type { AuditEvent } from '../shared/diagnosticsTypes';

export class AuditService {
  private readonly insert: Database.Statement;
  private readonly recent: Database.Statement;

  constructor(private readonly connection: Database.Database) {
    this.insert = connection.prepare('INSERT INTO audit_events (event, resource, created_at) VALUES (?, ?, ?)');
    this.recent = connection.prepare('SELECT id, event, resource, created_at as createdAt FROM audit_events ORDER BY id DESC LIMIT ?');
  }

  record(event: string, resource?: string): AuditEvent {
    const safeResource = resource && resource.length <= 500 ? resource : undefined;
    const createdAt = new Date().toISOString();
    const result = this.insert.run(event, safeResource, createdAt);
    return { id: Number(result.lastInsertRowid), event, resource: safeResource, createdAt };
  }

  list(limit = 25): AuditEvent[] {
    return (this.recent.all(Math.min(Math.max(limit, 1), 100)) as AuditEvent[]).map((event) => ({ ...event, resource: event.resource || undefined }));
  }
}