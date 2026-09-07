import { randomUUID } from 'node:crypto';
import type { CreateMemoryInput, Memory, UpdateMemoryInput, ListMemoriesOptions, SearchMemoriesOptions, MemoryCategory, MemoryImportance, MemorySource, MemoryEventType } from '../../shared/memoryTypes';
import { MemoryRepository } from './memoryRepository';

const categories: readonly MemoryCategory[] = ['WORKING', 'PROJECT', 'PREFERENCE', 'GOAL', 'DECISION', 'FACT', 'EPISODIC', 'ARCHIVED', 'ROUTINE', 'COMMUNICATION_STYLE', 'RELATIONSHIP_CONTEXT', 'USER_INSTRUCTION'];
const importanceLevels: readonly MemoryImportance[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const sources: readonly MemorySource[] = ['USER_PROVIDED', 'USER_EXPLICIT', 'USER_APPROVED', 'SYSTEM', 'PROJECT', 'CONVERSATION', 'IMPORTED', 'DEVELOPMENT'];

function validateInput(input: CreateMemoryInput): void {
  if (!input || typeof input.content !== 'string' || input.content.trim().length === 0 || input.content.length > 10000) throw new Error('Memory content must be between 1 and 10000 characters.');
  if (!categories.includes(input.category)) throw new Error('Invalid memory category.');
  if (!importanceLevels.includes(input.importance)) throw new Error('Invalid memory importance.');
  if (!sources.includes(input.source)) throw new Error('Invalid memory source.');
  if (input.tags && (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== 'string' || tag.length > 100))) throw new Error('Memory tags are invalid.');
  if (input.projectId !== undefined && typeof input.projectId !== 'string') throw new Error('Memory project ID is invalid.');
  if (input.metadata && (typeof input.metadata !== 'object' || Object.values(input.metadata).some((value) => typeof value !== 'string'))) throw new Error('Memory metadata is invalid.');
}

export class MemoryService {
  constructor(private readonly repository: MemoryRepository, private readonly onEvent?: (type: MemoryEventType, memoryId?: string) => void) {}
  createMemory(input: CreateMemoryInput): Memory { validateInput(input); const now = new Date().toISOString(); const memory = this.repository.insert({ id: randomUUID(), content: input.content.trim(), category: input.category, importance: input.importance, source: input.source, createdAt: now, updatedAt: now, tags: input.tags ?? [], projectId: input.projectId, archived: false, metadata: input.metadata ?? {} }); this.onEvent?.('MEMORY_CREATED', memory.id); return memory; }
  getMemory(id: string): Memory | null { this.validateId(id); return this.repository.findById(id); }
  updateMemory(id: string, input: UpdateMemoryInput): Memory { this.validateId(id); const current = this.repository.findById(id); if (!current) throw new Error('Memory not found.'); const candidate = { ...current, ...input }; validateInput(candidate); const updated = this.repository.update(id, { ...input, content: candidate.content }); if (!updated) throw new Error('Memory not found.'); this.onEvent?.('MEMORY_UPDATED', id); return updated; }
  deleteMemory(id: string): boolean { this.validateId(id); const deleted = this.repository.remove(id); if (deleted) this.onEvent?.('MEMORY_DELETED', id); return deleted; }
  listMemories(options?: ListMemoriesOptions): Memory[] { return this.repository.list(options); }
  searchMemories(options: SearchMemoriesOptions): Memory[] { if (!options || typeof options.query !== 'string' || options.query.length > 500) throw new Error('Memory search query is invalid.'); const results = this.repository.search(options); this.onEvent?.('MEMORY_SEARCHED'); return results; }
  archiveMemory(id: string): Memory { return this.setArchived(id, true); }
  restoreMemory(id: string): Memory { return this.setArchived(id, false); }
  private setArchived(id: string, archived: boolean): Memory { this.validateId(id); const updated = this.repository.update(id, { archived }); if (!updated) throw new Error('Memory not found.'); this.onEvent?.(archived ? 'MEMORY_ARCHIVED' : 'MEMORY_RESTORED', id); return updated; }
  private validateId(id: string): void { if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw new Error('Memory ID is invalid.'); }
}
