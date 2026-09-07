import type { TeshVisualState } from '../state/teshVisualState';
import {
  type AudioState,
  type InteractionContext,
  type PermissionRequest,
  type SimulationTiming,
  type TeshEvent,
  type TeshEventType,
  TeshApplicationError,
  type TransitionResult
} from './teshInteractionTypes';

const validTransitions: Readonly<Record<TeshVisualState, readonly TeshVisualState[]>> = {
  idle: ['listening', 'offline'],
  listening: ['thinking', 'idle'],
  thinking: ['speaking', 'processing', 'error', 'idle'],
  speaking: ['idle', 'error'],
  processing: ['thinking', 'success', 'error', 'permission'],
  permission: ['processing', 'idle'],
  success: ['idle'],
  error: ['idle'],
  offline: ['idle', 'listening']
};

const defaultTiming: SimulationTiming = { listeningMs: 2000, thinkingMs: 2000, speakingMs: 3000 };

type Listener = () => void;

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialContext(now: number): InteractionContext {
  return { state: 'idle', stateStartedAt: now, audio: { amplitude: 0 } };
}

export class TeshInteractionEngine {
  private context: InteractionContext;
  private readonly listeners = new Set<Listener>();
  private readonly events: TeshEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timing: SimulationTiming;

  constructor(now = Date.now(), timing: SimulationTiming = defaultTiming) {
    this.context = createInitialContext(now);
    this.timing = timing;
  }

  getContext(): InteractionContext {
    return this.context;
  }

  getEvents(): readonly TeshEvent[] {
    return [...this.events];
  }

  setTiming(timing: SimulationTiming): void {
    this.timing = { ...timing };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  activate(): TransitionResult {
    if (this.context.state === 'offline') {
      this.context = { ...this.context, sessionId: createSessionId(), error: undefined };
      this.emit('SESSION_STARTED');
      return this.transition('listening', 'TESH_ACTIVATED');
    }
    if (this.context.state !== 'idle') return this.reject('INVALID_ACTIVATION', 'Tesh can only activate from idle.');
    this.context = { ...this.context, sessionId: createSessionId(), error: undefined };
    this.emit('SESSION_STARTED');
    return this.transition('listening', 'TESH_ACTIVATED');
  }

  beginListening(): TransitionResult { return this.transition('listening', 'LISTENING_STARTED'); }
  stopListening(): TransitionResult { return this.transition('idle', 'LISTENING_STOPPED'); }
  beginThinking(): TransitionResult { return this.transition('thinking', 'THINKING_STARTED'); }
  completeThinking(): TransitionResult { return this.transition('idle', 'ACTION_COMPLETED'); }
  beginProcessing(task?: string): TransitionResult {
    const result = this.transition('processing', 'PROCESSING_STARTED');
    if (result.accepted && task) this.context = { ...this.context, processingTask: task };
    return result;
  }
  beginSpeaking(audio: AudioState = { amplitude: 0 }): TransitionResult {
    const result = this.transition('speaking', 'SPEAKING_STARTED');
    if (result.accepted) this.context = { ...this.context, audio: { ...audio } };
    return result;
  }
  completeSpeaking(): TransitionResult { return this.transition('idle', 'ACTION_COMPLETED'); }
  requestPermission(request: PermissionRequest): TransitionResult {
    const result = this.transition('permission', 'PERMISSION_REQUESTED');
    if (result.accepted) this.context = { ...this.context, permissionRequest: { ...request } };
    return result;
  }
  resolvePermission(granted: boolean): TransitionResult {
    if (!granted) return this.transition('idle', 'ACTION_COMPLETED');
    return this.transition('processing', 'ACTION_COMPLETED');
  }
  success(): TransitionResult { return this.transition('success', 'ACTION_COMPLETED'); }
  error(error: TeshApplicationError): TransitionResult {
    const result = this.transition('error', 'ERROR_OCCURRED');
    if (result.accepted) this.context = { ...this.context, error };
    return result;
  }
  goOffline(): TransitionResult {
    this.clearTimer();
    if (this.context.state === 'offline') return { accepted: true, context: this.getContext() };
    return this.transition('offline', 'OFFLINE');
  }
  goOnline(): TransitionResult {
    if (this.context.state !== 'offline') return this.reject('INVALID_ONLINE', 'Tesh is already online.');
    return this.transition('idle', 'ONLINE');
  }
  reset(): TransitionResult {
    this.clearTimer();
    if (this.context.sessionId) this.emit('SESSION_ENDED');
    this.context = createInitialContext(Date.now());
    this.notify();
    return { accepted: true, context: this.getContext() };
  }

  simulateInteraction(): void {
    this.clearTimer();
    if (!this.activate().accepted) return;
    this.schedule(() => {
      if (!this.beginThinking().accepted) return;
      this.schedule(() => {
        if (!this.beginSpeaking({ amplitude: 0.35 }).accepted) return;
        this.schedule(() => { this.stopSpeaking(); }, this.timing.speakingMs);
      }, this.timing.thinkingMs);
    }, this.timing.listeningMs);
  }

  simulateState(target: TeshVisualState): TransitionResult {
    this.clearTimer();
    if (target === 'idle') return this.reset();
    if (this.context.state !== 'idle') this.reset();
    if (target === 'offline') return this.goOffline();
    if (target === 'listening') return this.activate();
    this.activate();
    if (target === 'thinking') return this.beginThinking();
    if (target === 'speaking') { this.beginThinking(); return this.beginSpeaking({ amplitude: 0.35 }); }
    if (target === 'processing') { this.beginThinking(); return this.beginProcessing('development simulation'); }
    if (target === 'error') { this.beginThinking(); return this.error(new TeshApplicationError('SIMULATED_ERROR', 'Development-only simulated error.')); }
    this.beginThinking();
    this.beginProcessing('development simulation');
    if (target === 'permission') return this.requestPermission({ id: 'development-permission', capability: 'development simulation', requestedAt: Date.now() });
    if (target === 'success') { this.beginProcessing('development simulation'); return this.success(); }
    return this.reject('UNSUPPORTED_SIMULATION', `No development simulation exists for ${target}.`);
  }

  setAudio(audio: AudioState): void {
    this.context = { ...this.context, audio: { amplitude: Math.max(0, Math.min(1, audio.amplitude)), frequency: audio.frequency } };
    this.notify();
  }

  private stopSpeaking(): void {
    if (this.context.state !== 'speaking') return;
    const sessionId = this.context.sessionId;
    this.completeSpeaking();
    if (sessionId) this.emit('SESSION_ENDED');
  }

  private transition(nextState: TeshVisualState, eventType: TeshEventType): TransitionResult {
    if (this.context.state === nextState) return { accepted: true, context: this.getContext() };
    if (!validTransitions[this.context.state].includes(nextState)) return this.reject('INVALID_TRANSITION', `Cannot transition from ${this.context.state} to ${nextState}.`);
    const previousState = this.context.state;
    this.context = { ...this.context, state: nextState, previousState, stateStartedAt: Date.now() };
    this.emit(eventType);
    return { accepted: true, context: this.getContext() };
  }

  private reject(code: string, message: string): TransitionResult {
    const error = new TeshApplicationError(code, message);
    return { accepted: false, context: this.getContext(), error };
  }

  private emit(type: TeshEventType, error?: TeshApplicationError): void {
    this.events.push({ type, timestamp: Date.now(), sessionId: this.context.sessionId, error });
    this.notify();
  }

  private notify(): void { this.listeners.forEach((listener) => listener()); }
  private schedule(callback: () => void, delay: number): void { this.timer = setTimeout(callback, delay); }
  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
}

export { validTransitions };
