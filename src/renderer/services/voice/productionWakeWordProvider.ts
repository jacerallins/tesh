import { VoiceError, type WakeWordProvider } from '../../../shared/voice';

/**
 * Production-safe boundary for wake-word detection.
 * A real always-listening engine must be installed before background wake detection is enabled.
 */
export class ProductionWakeWordProvider implements WakeWordProvider {
  constructor(readonly phrase: string) {}

  async start(): Promise<void> {
    throw new VoiceError('WAKE_WORD_UNAVAILABLE', 'Production wake-word detection is not configured.');
  }

  async stop(): Promise<void> {}

  onDetected(_callback: () => void): () => void { return () => {}; }
}
