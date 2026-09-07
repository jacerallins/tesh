import { ipcMain } from 'electron';
import type { ActionAuthorizationRequest, PermissionDuration, PermissionType } from '../../shared/permissionTypes';
import { PermissionService } from './permissionService';

const permissionValues = ['READ', 'WRITE', 'EXECUTE', 'DELETE', 'COMMUNICATE', 'LOCATION', 'MICROPHONE', 'CAMERA', 'SYSTEM_DIAGNOSTICS', 'DEVICE_ACCESS', 'NETWORK', 'MEMORY_ACCESS'] as const;
const durationValues = ['ONCE', 'SESSION', 'UNTIL_REVOKED'] as const;
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request payload is invalid.'); return value as Record<string, unknown>; }
export function validatePermissionType(value: unknown): PermissionType { if (!permissionValues.includes(value as PermissionType)) throw new Error('Permission type is invalid.'); return value as PermissionType; }
export function validateDuration(value: unknown): PermissionDuration { if (!durationValues.includes(value as PermissionDuration)) throw new Error('Permission duration is invalid.'); return value as PermissionDuration; }
export function validateAuthorization(value: unknown): ActionAuthorizationRequest { const input = record(value); if (typeof input.capabilityId !== 'string' || input.capabilityId.length > 100) throw new Error('Capability ID is invalid.'); if (input.requestedPermissions && (!Array.isArray(input.requestedPermissions) || input.requestedPermissions.some((permission) => !permissionValues.includes(permission as PermissionType)))) throw new Error('Requested permissions are invalid.'); if (input.resource !== undefined && (typeof input.resource !== 'string' || input.resource.length > 1000)) throw new Error('Resource scope is invalid.'); return input as unknown as ActionAuthorizationRequest; }

export function registerPermissionIpc(service: PermissionService): void {
  ipcMain.handle('permission:capabilities', () => service.listCapabilities());
  ipcMain.handle('permission:list', () => service.listPermissions());
  ipcMain.handle('permission:grant', (_event, permission: unknown, scope: unknown, duration: unknown) => service.grantPermission(validatePermissionType(permission), validateScope(scope), validateDuration(duration)));
  ipcMain.handle('permission:deny', (_event, permission: unknown, scope: unknown) => service.denyPermission(validatePermissionType(permission), validateScope(scope)));
  ipcMain.handle('permission:revoke', (_event, id: unknown) => service.revokePermission(String(id)));
  ipcMain.handle('permission:check', (_event, permission: unknown, scope: unknown) => service.checkPermission(validatePermissionType(permission), validateScope(scope)));
  ipcMain.handle('permission:authorize', (_event, request: unknown) => service.authorizeAction(validateAuthorization(request)));
  ipcMain.handle('permission:trust', () => service.getTrust());
}

function validateScope(value: unknown): string | undefined { if (value === undefined) return undefined; if (typeof value !== 'string' || value.length > 1000) throw new Error('Permission scope is invalid.'); return value; }
