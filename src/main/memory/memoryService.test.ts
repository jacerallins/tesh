import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeMemoryDatabase } from './memoryDatabase';
import { MemoryRepository } from './memoryRepository';
import { MemoryService } from './memoryService';

const input = { content: 'MOTN needs a new hoodie sample.', category: 'PROJECT' as const, importance: 'HIGH' as const, source: 'USER_PROVIDED' as const, tags: ['MOTN', 'design'] };

describe('local memory foundation', () => {
  const databasePaths: string[] = [];
  afterEach(() => { databasePaths.splice(0).forEach((databasePath) => { for (const suffix of ['', '-shm', '-wal']) { try { fs.unlinkSync(databasePath + suffix); } catch { } } }); });

  function createService(databasePath = path.join(os.tmpdir(), `tesh-memory-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)) {
    databasePaths.push(databasePath);
    const database = initializeMemoryDatabase(databasePath);
    return { service: new MemoryService(new MemoryRepository(database.connection)), close: database.close };
  }

  it('initializes and persists a memory across database reopen', () => {
    const first = createService(); const memory = first.service.createMemory(input); first.close();
    const second = createService(databasePaths[0]); expect(second.service.getMemory(memory.id)?.content).toBe(input.content); second.close();
  });

  it('supports CRUD, search, archive, and restore', () => {
    const { service, close } = createService(); const memory = service.createMemory(input);
    expect(service.listMemories()).toHaveLength(1); expect(service.searchMemories({ query: 'hoodie' })).toHaveLength(1);
    const updated = service.updateMemory(memory.id, { importance: 'CRITICAL' }); expect(updated.importance).toBe('CRITICAL');
    expect(service.archiveMemory(memory.id).archived).toBe(true); expect(service.listMemories()).toHaveLength(0); expect(service.restoreMemory(memory.id).archived).toBe(false);
    expect(service.deleteMemory(memory.id)).toBe(true); expect(service.getMemory(memory.id)).toBeNull(); close();
  });

  it('rejects invalid input and IDs', () => {
    const { service, close } = createService();
    expect(() => service.createMemory({ ...input, content: '' })).toThrow();
    expect(() => service.createMemory({ ...input, category: 'NOPE' as never })).toThrow();
    expect(() => service.getMemory('not-an-id')).toThrow(); close();
  });
});
