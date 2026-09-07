import { describe, expect, it } from 'vitest';
import { requireCreateMemory, requireMemoryId, requireSearchMemories } from './memoryIpc';

describe('memory IPC validation', () => {
  it('rejects malformed IDs and payloads', () => {
    expect(() => requireMemoryId('bad')).toThrow();
    expect(() => requireCreateMemory(null)).toThrow();
    expect(() => requireCreateMemory({ content: 'x', category: 'BAD', importance: 'NORMAL', source: 'USER_PROVIDED' })).toThrow();
  });

  it('accepts only structured search options', () => {
    expect(requireSearchMemories({ query: 'MOTN', limit: 10 })).toEqual({ query: 'MOTN', limit: 10, offset: undefined, includeArchived: false });
    expect(() => requireSearchMemories({ query: 42 })).toThrow();
    expect(() => requireSearchMemories('MOTN')).toThrow();
  });
});