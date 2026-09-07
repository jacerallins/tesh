export const syncResourceTypes = ['MEMORY', 'CONVERSATION', 'ROUTINE', 'PREFERENCE', 'PERMISSION', 'DEVICE_STATE'] as const;
export type SyncResourceType = (typeof syncResourceTypes)[number];
export const syncOperations = ['UPSERT', 'DELETE'] as const;
export type SyncOperation = (typeof syncOperations)[number];
export interface SyncChange { id: string; resource: SyncResourceType; operation: SyncOperation; resourceId: string; version: number; updatedAt: string; payload: Record<string, unknown>; }
export interface SyncCursor { deviceId: string; lastVersion: number; }
export interface SyncQueueBridge { enqueue: (change: Omit<SyncChange, 'id'>) => Promise<SyncChange>; listPending: (deviceId: string, limit?: number) => Promise<SyncChange[]>; acknowledge: (deviceId: string, version: number) => Promise<void>; }
