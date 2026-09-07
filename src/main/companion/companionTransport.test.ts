import { describe, expect, it } from 'vitest';
import type { CompanionMessage } from '../../shared/companionTypes';
import { LocalDevelopmentTransport } from './companionTransport';

describe('LocalDevelopmentTransport', () => {
  it('is offline by default and delivers only after connect', async () => {
    const transport = new LocalDevelopmentTransport();
    const message = { messageId: 'm', deviceId: 'd', type: 'PING', timestamp: new Date().toISOString(), requestId: 'r', payload: {} } as CompanionMessage;
    await expect(transport.send(message)).rejects.toThrow('offline');
    const received: CompanionMessage[] = []; transport.receive((value) => received.push(value)); await transport.connect(); await transport.send(message); expect(received).toEqual([message]); await transport.close(); expect(transport.state).toBe('OFFLINE');
  });
});