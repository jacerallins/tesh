import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { ConversationRepository } from './conversationRepository';

describe('ConversationRepository', () => {
  it('persists and reloads a snapshot', () => {
    const db = new Database(':memory:');
    const repository = new ConversationRepository(db);
    const snapshot = { id: '00000000-0000-0000-0000-000000000001', messages: [], status: 'IDLE' as const, provider: 'test', model: 'test', createdAt: new Date().toISOString() };
    repository.save(snapshot);
    expect(repository.get(snapshot.id)?.id).toBe(snapshot.id);
    expect(repository.list()).toHaveLength(1);
    db.close();
  });
});
