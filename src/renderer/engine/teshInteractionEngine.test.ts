import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeshInteractionEngine } from './teshInteractionEngine';
import { TeshApplicationError } from './teshInteractionTypes';

describe('TeshInteractionEngine', () => {
  let engine: TeshInteractionEngine;

  beforeEach(() => { vi.useFakeTimers(); engine = new TeshInteractionEngine(); });
  afterEach(() => { vi.useRealTimers(); });

  it('accepts the normal interaction path and tracks previous state', () => {
    const activation = engine.activate();
    expect(activation.accepted).toBe(true);
    expect(engine.getContext().state).toBe('listening');
    expect(engine.getContext().sessionId).toBeDefined();
    engine.beginThinking();
    expect(engine.getContext().previousState).toBe('listening');
    engine.beginSpeaking({ amplitude: 0.4 });
    expect(engine.getContext().audio.amplitude).toBe(0.4);
  });

  it('rejects invalid transitions without mutating state', () => {
    const result = engine.beginSpeaking();
    expect(result.accepted).toBe(false);
    expect(result.error?.code).toBe('INVALID_TRANSITION');
    expect(engine.getContext().state).toBe('idle');
  });

  it('recovers typed errors back to idle', () => {
    engine.activate(); engine.beginThinking();
    const error = new TeshApplicationError('TEST_ERROR', 'Test failure.');
    engine.error(error);
    expect(engine.getContext().error?.code).toBe('TEST_ERROR');
    engine.reset();
    expect(engine.getContext().state).toBe('idle');
    expect(engine.getContext().sessionId).toBeUndefined();
  });

  it('supports offline and online transitions', () => {
    engine.goOffline();
    expect(engine.getContext().state).toBe('offline');
    engine.goOnline();
    expect(engine.getContext().state).toBe('idle');
  });

  it('cleans up simulation timers when reset is called', () => {
    engine.setTiming({ listeningMs: 100, thinkingMs: 100, speakingMs: 100 });
    engine.simulateInteraction();
    expect(engine.getContext().state).toBe('listening');
    engine.reset();
    vi.advanceTimersByTime(1000);
    expect(engine.getContext().state).toBe('idle');
    expect(engine.getEvents().filter((event) => event.type === 'SESSION_ENDED')).toHaveLength(1);
  });

  it('ends a simulated session after configured timing', () => {
    engine.setTiming({ listeningMs: 10, thinkingMs: 20, speakingMs: 30 });
    engine.simulateInteraction();
    vi.advanceTimersByTime(10); expect(engine.getContext().state).toBe('thinking');
    vi.advanceTimersByTime(20); expect(engine.getContext().state).toBe('speaking');
    vi.advanceTimersByTime(30); expect(engine.getContext().state).toBe('idle');
    expect(engine.getEvents().some((event) => event.type === 'SESSION_ENDED')).toBe(true);
  });

  it('reaches every development state through the transition rules', () => {
    for (const target of ['idle', 'listening', 'thinking', 'speaking', 'processing', 'permission', 'success', 'error', 'offline'] as const) {
      const result = engine.simulateState(target);
      expect(result.accepted, target).toBe(true);
      expect(engine.getContext().state, target).toBe(target);
    }
  });
});
