import type { WakeWordProvider } from '../../../shared/voice';

export class NativeWakeWordProvider implements WakeWordProvider {
  readonly phrase = 'Tesh';
  private unsubscribe?: () => void;

  async start(): Promise<void> {
    if (!window.tesh?.nativeWakeWord) throw new Error('Native Tesh wake-word bridge is unavailable.');
    await window.tesh.nativeWakeWord.start();
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await window.tesh?.nativeWakeWord?.stop();
  }

  onDetected(callback: () => void): () => void {
    this.unsubscribe?.();
    this.unsubscribe = window.tesh?.nativeWakeWord?.onDetected(callback);
    return () => { this.unsubscribe?.(); this.unsubscribe = undefined; };
  }
}
