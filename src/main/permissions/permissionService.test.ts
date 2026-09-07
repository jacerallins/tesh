import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeMemoryDatabase } from '../memory/memoryDatabase';
import { PermissionRepository } from './permissionRepository';
import { PermissionService } from './permissionService';

function createService(databasePath = path.join(os.tmpdir(), `tesh-permissions-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)) {
  const database = initializeMemoryDatabase(databasePath);
  return { service: new PermissionService(new PermissionRepository(database.connection)), close: database.close, databasePath };
}

describe('PermissionService', () => {
  const files: string[] = [];
  afterEach(() => { vi.useRealTimers(); files.splice(0).forEach((file) => { for (const suffix of ['', '-shm', '-wal']) { try { fs.unlinkSync(file + suffix); } catch { } } }); });

  it('defaults to UNKNOWN and requires explicit permission', () => {
    const { service, close, databasePath } = createService(); files.push(databasePath);
    expect(service.checkPermission('MEMORY_ACCESS')).toBe('UNKNOWN');
    expect(service.authorizeAction({ capabilityId: 'memory.read' }).result).toBe('REQUIRES_PERMISSION'); close();
  });

  it('grants, denies, revokes, and persists scoped permissions', () => {
    const first = createService(); files.push(first.databasePath);
    const granted = first.service.grantPermission('READ', 'C:\\Users\\User\\Documents\\Projects', 'UNTIL_REVOKED');
    expect(first.service.checkPermission('READ', 'C:\\Users\\User\\Documents\\Projects\\MOTN')).toBe('GRANTED');
    expect(first.service.checkPermission('READ', 'C:\\Users\\User\\Documents\\Private')).toBe('UNKNOWN');
    first.close();
    const second = createService(first.databasePath); expect(second.service.listPermissions()).toHaveLength(1); expect(second.service.revokePermission(granted.id)).toBe(true); expect(second.service.checkPermission('READ', 'C:\\Users\\User\\Documents\\Projects')).toBe('UNKNOWN'); second.close();
  });

  it('denial always wins and trust does not override it', () => {
    const { service, close, databasePath } = createService(); files.push(databasePath);
    service.grantPermission('MEMORY_ACCESS', undefined, 'UNTIL_REVOKED'); service.denyPermission('MEMORY_ACCESS', undefined);
    expect(service.getTrust().trust).toBe('LIMITED'); expect(service.authorizeAction({ capabilityId: 'memory.read' }).result).toBe('DENIED'); close();
  });

  it('handles expiry and confirmation requirements', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-23T00:00:00Z'));
    const { service, close, databasePath } = createService(); files.push(databasePath);
    service.grantPermission('MEMORY_ACCESS', undefined, 'ONCE'); expect(service.checkPermission('MEMORY_ACCESS')).toBe('GRANTED'); vi.advanceTimersByTime(60 * 60 * 1000); expect(service.checkPermission('MEMORY_ACCESS')).toBe('UNKNOWN');
    service.grantPermission('DELETE', 'C:\\Temp', 'UNTIL_REVOKED'); expect(service.authorizeAction({ capabilityId: 'file.delete', resource: 'C:\\Temp\\old.txt' }).result).toBe('REQUIRES_CONFIRMATION'); expect(service.authorizeAction({ capabilityId: 'file.delete', resource: 'C:\\Temp\\old.txt', confirmed: true }).result).toBe('ALLOWED'); close();
  });

  it('rejects invalid permission inputs', () => {
    const { service, close, databasePath } = createService(); files.push(databasePath);
    expect(() => service.grantPermission('BAD' as never, undefined, 'UNTIL_REVOKED')).toThrow(); expect(() => service.grantPermission('READ', 'x'.repeat(1001), 'UNTIL_REVOKED')).toThrow(); close();
  });
});
