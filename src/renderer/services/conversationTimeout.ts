import type { InteractionContext } from '../engine/teshInteractionTypes';

export const conversationTimeoutOptions = [30, 60, 120, 180, 300, 600, 0] as const;
export type ConversationTimeoutSeconds = (typeof conversationTimeoutOptions)[number];
export const defaultConversationTimeout: ConversationTimeoutSeconds = 180;
export const conversationTimeoutStorageKey = 'tesh.conversation.inactivity-timeout';

function defaultStorage(): Pick<Storage, 'getItem'> {
  return typeof localStorage === 'undefined' ? { getItem: () => null } : localStorage;
}

export function readConversationTimeout(storage: Pick<Storage, 'getItem'> = defaultStorage()): ConversationTimeoutSeconds {
  const stored = storage.getItem(conversationTimeoutStorageKey);
  const value = stored === null ? Number.NaN : Number(stored);
  return isValidConversationTimeout(value) ? value : defaultConversationTimeout;
}

export function writeConversationTimeout(value: number, storage: Pick<Storage, 'setItem'> = localStorage): ConversationTimeoutSeconds {
  if (!isValidConversationTimeout(value)) throw new Error('Conversation inactivity timeout must be one of the supported non-negative values.');
  storage.setItem(conversationTimeoutStorageKey, String(value));
  return value;
}

export function isValidConversationTimeout(value: number): value is ConversationTimeoutSeconds {
  return conversationTimeoutOptions.includes(value as ConversationTimeoutSeconds) && value >= 0;
}

export interface ConversationTimeoutScheduler {
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export class ConversationTimeoutController {
  private timer?: ReturnType<typeof setTimeout>;
  private context?: InteractionContext;
  private timeoutSeconds: ConversationTimeoutSeconds;

  constructor(private readonly onTimeout: () => void, timeoutSeconds = defaultConversationTimeout, private readonly scheduler: ConversationTimeoutScheduler = globalThis) {
    if (!isValidConversationTimeout(timeoutSeconds)) throw new Error('Invalid conversation inactivity timeout.');
    this.timeoutSeconds = timeoutSeconds;
  }

  updateTimeout(timeoutSeconds: number): void {
    if (!isValidConversationTimeout(timeoutSeconds)) throw new Error('Invalid conversation inactivity timeout.');
    this.timeoutSeconds = timeoutSeconds;
    this.armIfInactive();
  }

  updateContext(context: InteractionContext): void {
    this.context = context;
    this.armIfInactive();
  }

  userSpoke(): void {
    this.armIfInactive();
  }

  dispose(): void {
    this.clear();
    this.context = undefined;
  }

  private armIfInactive(): void {
    this.clear();
    if (!this.context?.sessionId || this.context.state !== 'idle' || this.timeoutSeconds === 0) return;
    this.timer = this.scheduler.setTimeout(this.onTimeout, this.timeoutSeconds * 1000);
  }

  private clear(): void {
    if (this.timer !== undefined) this.scheduler.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
