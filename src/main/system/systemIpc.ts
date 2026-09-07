import { ipcMain } from 'electron';
import type { FileCreateInput, FileDeleteInput, FileMoveInput, FileSearchOptions } from '../../shared/systemTypes';
import { FileService } from './fileService';
import { SystemService } from './systemService';

function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request payload is invalid.'); return value as Record<string, unknown>; }
function text(value: unknown, name: string): string { if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new Error(`${name} is invalid.`); return value; }
export function validatePath(value: unknown, name = 'Path'): string { return text(value, name); }
export function validateMoveInput(value: unknown): FileMoveInput { const input = record(value); return { source: validatePath(input.source, 'Source path'), destination: validatePath(input.destination, 'Destination path'), confirmed: input.confirmed === true }; }
export function validateCreateInput(value: unknown): FileCreateInput { const input = record(value); return { path: validatePath(input.path), content: text(input.content, 'File content') }; }
export function validateDeleteInput(value: unknown): FileDeleteInput { const input = record(value); return { path: validatePath(input.path), confirmed: input.confirmed === true }; }
export function validateSearchInput(value: unknown): FileSearchOptions { const input = record(value); const extensions = input.extensions === undefined ? undefined : input.extensions; if (extensions && (!Array.isArray(extensions) || extensions.some((item) => typeof item !== 'string' || item.length > 20))) throw new Error('Extensions are invalid.'); if (input.limit !== undefined && (typeof input.limit !== 'number' || !Number.isFinite(input.limit))) throw new Error('Search limit is invalid.'); if (input.offset !== undefined && (typeof input.offset !== 'number' || !Number.isFinite(input.offset))) throw new Error('Search offset is invalid.'); return { root: validatePath(input.root), query: input.query === undefined ? undefined : text(input.query, 'Search query'), extensions: extensions as string[] | undefined, limit: input.limit as number | undefined, offset: input.offset as number | undefined }; }

export function registerSystemIpc(files: FileService, system: SystemService, setDevelopmentSession: (verified: boolean) => void): void {
  ipcMain.handle('system:search', (_event, input: unknown) => files.search(validateSearchInput(input)));
  ipcMain.handle('system:read', (_event, filePath: unknown) => files.read(validatePath(filePath)));
  ipcMain.handle('system:display', (_event, filePath: unknown) => files.display(validatePath(filePath)));
  ipcMain.handle('system:create', (_event, input: unknown) => files.create(validateCreateInput(input)));
  ipcMain.handle('system:rename', (_event, input: unknown) => files.rename(validateMoveInput(input)));
  ipcMain.handle('system:move', (_event, input: unknown) => files.move(validateMoveInput(input)));
  ipcMain.handle('system:delete', (_event, input: unknown) => files.delete(validateDeleteInput(input)));
  ipcMain.handle('system:diagnostics', () => system.getDiagnostics());
  ipcMain.handle('system:set-development-session', (_event, verified: unknown) => { if (typeof verified !== 'boolean') throw new Error('Session status is invalid.'); setDevelopmentSession(verified); });
}