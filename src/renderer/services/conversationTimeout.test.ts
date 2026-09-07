import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationTimeoutController, defaultConversationTimeout, readConversationTimeout, writeConversationTimeout } from './conversationTimeout';
import type { InteractionContext } from '../engine/teshInteractionTypes';

const context = (state: InteractionContext['state']): InteractionContext => ({ state, sessionId: 'session-1', stateStartedAt: Date.now(), audio: { amplitude: 0 } });

describe('ConversationTimeoutController', () => {
  afterEach(() => vi.useRealTimers());

  it('defaults to three minutes and dismisses only after inactivity', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const controller = new ConversationTimeoutController(onTimeout);
    controller.updateContext(context('idle'));
    vi.advanceTimersByTime(179_000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(defaultConversationTimeout).toBe(180);
  });

  it('supports custom values, reset on speech, and Never', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const controller = new ConversationTimeoutController(onTimeout, 30);
    controller.updateContext(context('idle'));
    vi.advanceTimersByTime(20_000);
    controller.userSpoke();
    vi.advanceTimersByTime(20_000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).toHaveBeenCalledOnce();
    controller.updateTimeout(0);
    controller.updateContext(context('idle'));
    vi.advanceTimersByTime(600_000);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('does not count protected interaction states as inactivity', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const controller = new ConversationTimeoutController(onTimeout, 30);
    for (const state of ['listening', 'thinking', 'processing', 'speaking', 'permission'] as const) {
      controller.updateContext(context(state));
      vi.advanceTimersByTime(60_000);
    }
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('persists valid values and rejects invalid values', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(readConversationTimeout(storage)).toBe(180);
    expect(writeConversationTimeout(300, storage)).toBe(300);
    expect(readConversationTimeout(storage)).toBe(300);
    expect(() => writeConversationTimeout(-1, storage)).toThrow();
    expect(() => writeConversationTimeout(31, storage)).toThrow();
  });
});
