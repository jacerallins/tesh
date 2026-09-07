import { VoiceError, type WakeWordProvider } from '../../../shared/voice';

export class NativeWakeWordProvider implements WakeWordProvider {
  constructor(public readonly phrase: string) {}
  async start(): Promise<void> {
    const bridge = window.tesh?.voice;
    if (!bridge) throw new VoiceError('WAKE_WORD_UNAVAILABLE', 'Native wake-word bridge is unavailable.');
    try { await bridge.start(this.phrase); }
    catch (error) { throw new VoiceError('WAKE_WORD_UNAVAILABLE', error instanceof Error ? error.message : 'Native wake-word engine could not start.'); }
  }
  async stop(): Promise<void> { await window.tesh?.voice?.stop(); }
  onDetected(callback: () => void): () => void {
    const bridge = window.tesh?.voice;
    if (!bridge) throw new VoiceError('WAKE_WORD_UNAVAILABLE', 'Native wake-word bridge is unavailable.');
    return bridge.onDetected(callback);
  }
}
