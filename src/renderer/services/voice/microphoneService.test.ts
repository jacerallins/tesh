import { describe, expect, it, vi } from 'vitest';
import { MicrophoneService } from './microphoneService';

describe('MicrophoneService', () => {
  it('fails closed and does not call getUserMedia when permission is unknown', async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
    const service = new MicrophoneService(() => ({ check: async () => 'UNKNOWN' } as never));
    await expect(service.start()).rejects.toMatchObject({ code: 'MICROPHONE_PERMISSION_DENIED' });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(service.getStatus()).toBe('inactive');
    await service.dispose();
  });

  it('fails closed when permission is denied', async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
    const service = new MicrophoneService(() => ({ check: async () => 'DENIED' } as never));
    await expect(service.start()).rejects.toMatchObject({ code: 'MICROPHONE_PERMISSION_DENIED' });
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});