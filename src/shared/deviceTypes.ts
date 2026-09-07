export const devicePlatforms = ['WINDOWS', 'IOS', 'MACOS', 'LINUX', 'ANDROID', 'UNKNOWN'] as const;
export type DevicePlatform = (typeof devicePlatforms)[number];

export type DeviceRole = 'PRIMARY' | 'COMPANION';
export type DeviceTrust = 'UNTRUSTED' | 'PAIRED' | 'TRUSTED' | 'REVOKED';

export interface TeshDevice {
  id: string;
  name: string;
  platform: DevicePlatform;
  model?: string;
  role: DeviceRole;
  trust: DeviceTrust;
  appVersion?: string;
  lastSeenAt?: string;
  capabilities: string[];
  online: boolean;
}

export type SyncEntityType = 'MEMORY' | 'CONVERSATION' | 'ROUTINE' | 'PREFERENCE' | 'PERMISSION' | 'DEVICE_STATE';
export type SyncChangeType = 'UPSERT' | 'DELETE';

export interface SyncEnvelope<T = unknown> {
  id: string;
  deviceId: string;
  entity: SyncEntityType;
  change: SyncChangeType;
  entityId: string;
  version: number;
  timestamp: string;
  payload?: T;
}

export interface DeviceSyncState {
  deviceId: string;
  lastSyncAt?: string;
  lastCursor?: string;
  pendingChanges: number;
  status: 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR';
}

export interface DeviceActionRequest {
  deviceId: string;
  action: string;
  input: Record<string, unknown>;
  requiresUserConfirmation: boolean;
}
