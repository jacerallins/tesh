import { ipcMain } from 'electron';
import type { CreateDraftInput } from '../../shared/communicationTypes';
import type { CommunicationService } from './communicationService';
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Communication payload is invalid.'); return value as Record<string, unknown>; }
function boundedText(value: unknown, name: string): string { if (typeof value !== 'string' || !value.trim() || value.length > 10000) throw new Error(`${name} is invalid.`); return value; }
export function validateDraft(value: unknown): CreateDraftInput { const input = record(value); return { recipientQuery: boundedText(input.recipientQuery, 'Recipient'), contactId: input.contactId === undefined ? undefined : boundedText(input.contactId, 'Contact ID'), content: boundedText(input.content, 'Message'), provider: input.provider as CreateDraftInput['provider'], styleProfileUsed: input.styleProfileUsed === undefined ? undefined : boundedText(input.styleProfileUsed, 'Style profile') }; }
export function registerCommunicationIpc(service: CommunicationService): void {
  ipcMain.handle('communication:contacts', () => service.getContacts());
  ipcMain.handle('communication:resolve', (_event, query: unknown) => service.resolveRecipient(boundedText(query, 'Recipient')));
  ipcMain.handle('communication:draft-create', (_event, input: unknown) => service.createDraft(validateDraft(input)));
  ipcMain.handle('communication:draft-update', (_event, id: unknown, content: unknown) => service.updateDraft(boundedText(id, 'Draft ID'), boundedText(content, 'Message')));
  ipcMain.handle('communication:send-confirm', (_event, id: unknown, approved: unknown) => { if (typeof approved !== 'boolean') throw new Error('Confirmation is invalid.'); return service.confirmSend(boundedText(id, 'Draft ID'), approved); });
  ipcMain.handle('communication:draft-cancel', (_event, id: unknown) => service.cancelDraft(boundedText(id, 'Draft ID')));
  ipcMain.handle('communication:snapshot', () => service.getSnapshot());
}