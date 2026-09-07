import type { PermissionGrant, PermissionState } from '../shared/permissionTypes';

export interface CapabilityStatus { name: string; state: string; detail: string; }

export function deriveCapabilityStatuses(permissions: PermissionGrant[], aiConfigured: boolean, companionAvailable: boolean, voiceState: string): CapabilityStatus[] {
  const microphone: PermissionState = permissions.find((item) => item.permission === 'MICROPHONE')?.state ?? 'UNKNOWN';
  const files: PermissionState = permissions.find((item) => ['READ', 'WRITE', 'DELETE'].includes(item.permission))?.state ?? 'UNKNOWN';
  return [
    { name: 'Voice', state: microphone === 'GRANTED' ? (voiceState === 'inactive' ? 'Ready' : 'Active') : 'Permission required', detail: microphone === 'DENIED' ? 'Microphone access is blocked.' : 'Uses the browser microphone and speech recognition providers.' },
    { name: 'Wake word', state: 'Development only', detail: 'Tesh Pineapples uses the development wake-word provider.' },
    { name: 'Speaker verification', state: 'Development mode', detail: 'Development speaker verification; real biometric verification is unavailable.' },
    { name: 'AI', state: aiConfigured ? 'Configured' : 'Not configured', detail: aiConfigured ? 'Provider credentials are configured in the main process.' : 'AI is not configured.' },
    { name: 'Filesystem', state: files === 'GRANTED' ? 'Enabled' : 'Permission required', detail: files === 'GRANTED' ? 'Authorized scopes are enforced by the permission system.' : 'No broad filesystem access is granted by default.' },
    { name: 'Companion', state: companionAvailable ? 'Available' : 'Not configured', detail: companionAvailable ? 'Uses the existing companion management service.' : 'Companion management is unavailable in this build.' }
  ];
}