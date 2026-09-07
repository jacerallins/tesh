import { randomUUID } from 'node:crypto';
import type { DeviceSyncState, SyncChangeType, SyncEntityType, SyncEnvelope } from '../../shared/deviceTypes';

export class DeviceSyncService {
  private readonly pending: SyncEnvelope[] = [];
  private cursor = 0;
  private status: DeviceSyncState['status'] = 'IDLE';
  private lastSyncAt?: string;

  constructor(private readonly deviceId: string) {}

  queue<T>(entity: SyncEntityType, change: SyncChangeType, entityId: string, payload?: T): SyncEnvelope<T> {
    if (!entityId.trim()) throw new Error('Sync entity ID is required.');
    const envelope: SyncEnvelope<T> = {
      id: randomUUID(),
      deviceId: this.deviceId,
      entity,
      change,
      entityId,
      version: this.cursor + this.pending.length + 1,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.pending.push(envelope);
    return envelope;
  }

  drain(limit = 50): SyncEnvelope[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Sync batch size is invalid.');
    return this.pending.splice(0, limit);
  }

  acknowledge(version: number): void {
    if (!Number.isInteger(version) || version < this.cursor) throw new Error('Sync cursor is invalid.');
    this.cursor = version;
    this.lastSyncAt = new Date().toISOString();
    this.status = this.pending.length ? 'IDLE' : 'IDLE';
  }

  markOffline(): void { this.status = 'OFFLINE'; }
  markSyncing(): void { this.status = 'SYNCING'; }
  markError(): void { this.status = 'ERROR'; }
  markIdle(): void { this.status = 'IDLE'; }

  getState(): DeviceSyncState {
    return { deviceId: this.deviceId, lastSyncAt: this.lastSyncAt, lastCursor: this.cursor ? String(this.cursor) : undefined, pendingChanges: this.pending.length, status: this.status };
  }
}
