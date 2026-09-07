import { VoiceError } from '../../../shared/voice';
import type { WakeWordProvider } from '../../../shared/voice';

export class WakeWordService {
  private unsubscribe?: () => void;
  private running = false;

  constructor(private readonly provider: WakeWordProvider) {}
  get phrase(): string { return this.provider.phrase; }
  async start(): Promise<void> { if (this.running) return; await this.provider.start(); this.running = true; }
  async stop(): Promise<void> { this.unsubscribe?.(); this.unsubscribe = undefined; await this.provider.stop(); this.running = false; }
  onWakeDetected(callback: () => void): () => void {
    if (!this.running) throw new VoiceError('WAKE_WORD_UNAVAILABLE', 'Wake-word detection is not active.');
    this.unsubscribe = this.provider.onDetected(callback);
    return () => { if (this.unsubscribe) this.unsubscribe(); this.unsubscribe = undefined; };
  }
}

export class DevelopmentWakeWordProvider implements WakeWordProvider {
  readonly phrase: string;
  private callback?: () => void;
  constructor(phrase: string) { this.phrase = phrase; }
  async start(): Promise<void> { return Promise.resolve(); }
  async stop(): Promise<void> { this.callback = undefined; }
  onDetected(callback: () => void): () => void { this.callback = callback; return () => { if (this.callback === callback) this.callback = undefined; }; }
  simulateDetection(): void { this.callback?.(); }
}