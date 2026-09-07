import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeMemoryDatabase } from './memory/memoryDatabase';
import { AuditService } from './auditService';

describe('AuditService', () => {
  const files: string[] = [];
  afterEach(() => files.splice(0).forEach((file) => ['', '-shm', '-wal'].forEach((suffix) => { try { fs.unlinkSync(file + suffix); } catch { } })));
  it('persists bounded, non-secret audit records', () => {
    const file = path.join(os.tmpdir(), `tesh-audit-${Date.now()}-${Math.random()}.sqlite`); files.push(file);
    const database = initializeMemoryDatabase(file); const audit = new AuditService(database.connection);
    audit.record('FILE_READ', 'C:\\workspace\\README.md'); audit.record('TOKEN_SHOULD_NOT_BE_LOGGED', 'x'.repeat(600));
    expect(audit.list()).toHaveLength(2); expect(audit.list()[0]?.resource).toBeUndefined(); expect(audit.list()[1]?.event).toBe('FILE_READ');
    database.close();
  });
});