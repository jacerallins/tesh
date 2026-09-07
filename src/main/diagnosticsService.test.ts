import { describe, expect, it } from 'vitest';
import { DiagnosticsService } from './diagnosticsService';

describe('DiagnosticsService', () => {
  it('keeps failure controls explicit and returns sanitized state', () => {
    const events: Array<[string, string | undefined]> = [];
    const audit = { record: (event: string, resource?: string) => { events.push([event, resource]); return { id: 1, event, resource, createdAt: new Date().toISOString() }; }, list: () => [] };
    const service = new DiagnosticsService(audit);
    expect(service.shouldFail('AI')).toBe(false);
    service.setFailure('AI', true);
    expect(service.shouldFail('AI')).toBe(true);
    expect(service.getSnapshot().failureInjection).toEqual({ AI: true });
    service.setFailure('AI', false);
    expect(service.shouldFail('AI')).toBe(false); expect(events).toHaveLength(2);
  });
});