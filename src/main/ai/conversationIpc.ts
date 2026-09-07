import { ipcMain } from 'electron';
import type { ConversationService } from './conversationService';

export function registerConversationIpc(service: ConversationService): void {
  ipcMain.handle('conversation:start', () => service.start());
  ipcMain.handle('conversation:send', (_event, conversationId: unknown, content: unknown) => { if (typeof conversationId !== 'string' || typeof content !== 'string') throw new Error('Conversation request is invalid.'); return service.send(conversationId, content); });
  ipcMain.handle('conversation:cancel', (_event, conversationId: unknown) => { if (typeof conversationId !== 'string') throw new Error('Conversation ID is invalid.'); return service.cancel(conversationId); });
  ipcMain.handle('conversation:confirm-tool', (_event, conversationId: unknown, requestId: unknown, approved: unknown) => { if (typeof conversationId !== 'string' || typeof requestId !== 'string' || typeof approved !== 'boolean') throw new Error('Tool confirmation is invalid.'); return service.confirmTool(conversationId, requestId, approved); });
  ipcMain.handle('conversation:config', () => service.getConfig());
  ipcMain.handle('conversation:status', () => service.getStatus());
}