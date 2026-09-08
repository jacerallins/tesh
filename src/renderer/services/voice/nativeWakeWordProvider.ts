import type { WakeWordProvider } from '../../../shared/voice';

export class NativeWakeWordProvider implements WakeWordProvider {
  readonly phrase = 'Tesh';
  private unsubscribe?: () => void;

  async start(): Promise<void> {
    const bridge = window.tesh?.nativeWakeWord;
    if (!bridge) return;
    const status = await bridge.status();
    if (!status.available || !status.configured) return;
    await bridge.start();
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
