import { ipcMain } from 'electron';
import type { ConversationPrivacy, MemoryCandidateInput } from '../../shared/memoryTypes';
import type { MemoryIntelligenceService } from './memoryIntelligenceService';
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request payload is invalid.'); return value as Record<string, unknown>; }
export function registerMemoryIntelligenceIpc(service: MemoryIntelligenceService): void {
  ipcMain.handle('memory:candidate-create', (_event, value: unknown, privacy: unknown) => { const input = record(value) as unknown as MemoryCandidateInput; if (typeof input.content !== 'string' || typeof input.category !== 'string' || typeof input.importance !== 'string' || typeof input.confidence !== 'number' || typeof input.reason !== 'string') throw new Error('Candidate input is invalid.'); return service.createCandidate(input, privacy === 'DO_NOT_STORE' || privacy === 'TEMPORARY_CONVERSATION' ? privacy : 'ALLOW_MEMORY'); });
  ipcMain.handle('memory:candidates', () => service.listCandidates());
  ipcMain.handle('memory:candidate-approve', (_event, id: unknown) => service.approveCandidate(String(id)));
  ipcMain.handle('memory:candidate-reject', (_event, id: unknown) => service.rejectCandidate(String(id)));
  ipcMain.handle('memory:retrieve-relevant', (_event, query: unknown) => { if (typeof query !== 'string') throw new Error('Memory query is invalid.'); return service.retrieveRelevant(query); });
  ipcMain.handle('memory:style-create', (_event, value: unknown) => service.createStyleProfile(record(value) as never));
  ipcMain.handle('memory:styles', () => service.listStyleProfiles());
}