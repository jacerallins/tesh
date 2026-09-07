import { ipcMain } from 'electron';
import type { CompanionPermission, PairInput } from '../../shared/companionTypes';
import type { CompanionService } from './companionService';

const permissions: readonly CompanionPermission[] = [
  'COMPANION_VIEW_STATUS',
  'COMPANION_SEND_COMMAND',
  'COMPANION_RECEIVE_NOTIFICATIONS',
  'COMPANION_SYNC_MEMORY',
  'COMPANION_SYNC_CONVERSATIONS',
  'COMPANION_SYNC_ROUTINES'
];
function text(value: unknown, label: string, max = 200): string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is invalid.`); return value; }
export function validatePairInput(value: unknown): PairInput { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pair input is invalid.'); const input = value as Record<string, unknown>; const platform = text(input.platform, 'Platform', 20); if (!['ANDROID', 'IOS', 'WINDOWS', 'MACOS', 'LINUX', 'UNKNOWN'].includes(platform)) throw new Error('Platform is invalid.'); return { challengeId: text(input.challengeId, 'Challenge ID', 80), code: text(input.code, 'Pairing code', 20), name: text(input.name, 'Device name', 80), platform: platform as PairInput['platform'], deviceType: text(input.deviceType, 'Device type', 80), publicKey: text(input.publicKey, 'Public key', 5000), signature: text(input.signature, 'Signature', 1000) }; }
export function validateCompanionPermission(value: unknown): CompanionPermission { if (typeof value !== 'string' || !permissions.includes(value as CompanionPermission)) throw new Error('Companion permission is invalid.'); return value as CompanionPermission; }
export function registerCompanionIpc(service: CompanionService, enabled: boolean): void { if (!enabled) return; ipcMain.handle('companion:snapshot', () => service.getSnapshot()); ipcMain.handle('companion:pairing-create', () => service.createPairingChallenge()); ipcMain.handle('companion:pair', (_event, input: unknown) => service.pair(validatePairInput(input))); ipcMain.handle('companion:disconnect', (_event, id: unknown) => service.disconnect(text(id, 'Device ID', 80))); ipcMain.handle('companion:revoke', (_event, id: unknown) => service.revoke(text(id, 'Device ID', 80))); ipcMain.handle('companion:permission-grant', (_event, id: unknown, permission: unknown) => service.grantPermission(text(id, 'Device ID', 80), validateCompanionPermission(permission))); }
