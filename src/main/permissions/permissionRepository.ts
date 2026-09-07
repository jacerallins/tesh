import type Database from 'better-sqlite3';
import type { PermissionGrant, PermissionState, PermissionType } from '../../shared/permissionTypes';

interface PermissionRow { id: string; permission: PermissionType; state: PermissionState; scope: string | null; duration: PermissionGrant['duration']; expires_at: string | null; created_at: string; updated_at: string; }
function map(row: PermissionRow): PermissionGrant { return { id: row.id, permission: row.permission, state: row.state, scope: row.scope ?? undefined, duration: row.duration, expiresAt: row.expires_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }
export class PermissionRepository {
  constructor(private readonly database: Database.Database) {}
  list(): PermissionGrant[] { return (this.database.prepare('SELECT * FROM permissions ORDER BY updated_at DESC').all() as PermissionRow[]).map(map); }
  find(id: string): PermissionGrant | null { const row = this.database.prepare('SELECT * FROM permissions WHERE id = ?').get(id) as PermissionRow | undefined; return row ? map(row) : null; }
  findMatching(permission: PermissionType, scope?: string): PermissionGrant[] { return this.list().filter((grant) => grant.permission === permission && (!grant.scope || !scope || scope === grant.scope || scope.startsWith(`${grant.scope}/`) || scope.startsWith(`${grant.scope}\\`))); }
  save(grant: PermissionGrant): PermissionGrant { this.database.prepare('INSERT INTO permissions (id, permission, state, scope, duration, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, scope = excluded.scope, duration = excluded.duration, expires_at = excluded.expires_at, updated_at = excluded.updated_at').run(grant.id, grant.permission, grant.state, grant.scope ?? null, grant.duration, grant.expiresAt ?? null, grant.createdAt, grant.updatedAt); return grant; }
  remove(id: string): boolean { return this.database.prepare('DELETE FROM permissions WHERE id = ?').run(id).changes === 1; }
}
