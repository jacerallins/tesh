import { describe, expect, it } from 'vitest';
import { DeviceSyncService } from './deviceSyncService';

describe('DeviceSyncService', () => {
  it('queues and drains changes with monotonic versions', () => {
    const service = new DeviceSyncService('primary');
    const first = service.queue('MEMORY', 'UPSERT', 'memory-1', { content: 'hello' });
    const second = service.queue('ROUTINE', 'UPSERT', 'routine-1');

    expect(first.deviceId).toBe('primary');
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(service.drain(10)).toHaveLength(2);
    expect(service.getState().pendingChanges).toBe(0);
  });

  it('tracks offline and sync state without losing queued work', () => {
    const service = new DeviceSyncService('iphone');
    service.queue('CONVERSATION', 'UPSERT', 'conversation-1');
    service.markOffline();
    expect(service.getState().status).toBe('OFFLINE');
    expect(service.getState().pendingChanges).toBe(1);
    service.markSyncing();
    expect(service.getState().status).toBe('SYNCING');
    service.acknowledge(1);
    expect(service.getState().lastCursor).toBe('1');
    expect(service.getState().lastSyncAt).toBeTruthy();
  });
});
