import { ipcMain } from 'electron';
import type { CreateMemoryInput, ListMemoriesOptions, MemoryBridge, SearchMemoriesOptions, UpdateMemoryInput } from '../../shared/memoryTypes';
import { MemoryService } from './memoryService';

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request payload is invalid.');
  return value as Record<string, unknown>;
}

export function requireMemoryId(value: unknown): string { if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) throw new Error('Memory ID is invalid.'); return value; }
export function requireCreateMemory(value: unknown): CreateMemoryInput { const input = requireRecord(value) as unknown as CreateMemoryInput; if (typeof input.content !== 'string' || !['WORKING', 'PROJECT', 'PREFERENCE', 'GOAL', 'DECISION', 'FACT', 'EPISODIC', 'ARCHIVED', 'ROUTINE', 'COMMUNICATION_STYLE', 'RELATIONSHIP_CONTEXT', 'USER_INSTRUCTION'].includes(input.category) || !['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(input.importance) || !['USER_PROVIDED', 'USER_EXPLICIT', 'USER_APPROVED', 'SYSTEM', 'PROJECT', 'CONVERSATION', 'IMPORTED', 'DEVELOPMENT'].includes(input.source)) throw new Error('Memory input is invalid.'); return input; }
export function requireMemoryOptions(value: unknown): ListMemoriesOptions { if (value === undefined) return {}; const options = requireRecord(value); return { includeArchived: options.includeArchived === true, limit: typeof options.limit === 'number' ? options.limit : undefined, offset: typeof options.offset === 'number' ? options.offset : undefined }; }
export function requireSearchMemories(value: unknown): SearchMemoriesOptions { const options = requireRecord(value); if (typeof options.query !== 'string') throw new Error('Memory search query is invalid.'); return { ...requireMemoryOptions(options), query: options.query }; }

export function registerMemoryIpc(service: MemoryService): void {
  ipcMain.handle('memory:create', (_event, input: unknown) => service.createMemory(requireCreateMemory(input)));
  ipcMain.handle('memory:get', (_event, id: unknown) => service.getMemory(requireMemoryId(id)));
  ipcMain.handle('memory:update', (_event, id: unknown, input: unknown) => service.updateMemory(requireMemoryId(id), requireRecord(input) as UpdateMemoryInput));
  ipcMain.handle('memory:delete', (_event, id: unknown) => service.deleteMemory(requireMemoryId(id)));
  ipcMain.handle('memory:list', (_event, options: unknown) => service.listMemories(requireMemoryOptions(options)));
  ipcMain.handle('memory:search', (_event, options: unknown) => service.searchMemories(requireSearchMemories(options)));
  ipcMain.handle('memory:archive', (_event, id: unknown) => service.archiveMemory(requireMemoryId(id)));
  ipcMain.handle('memory:restore', (_event, id: unknown) => service.restoreMemory(requireMemoryId(id)));
}

export type RegisteredMemoryBridge = Pick<MemoryBridge, 'create' | 'get' | 'update' | 'delete' | 'list' | 'search' | 'archive' | 'restore'>;
