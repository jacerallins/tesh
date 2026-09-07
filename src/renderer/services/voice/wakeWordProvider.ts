import type { WakeWordProvider } from '../../../shared/voice';

export class DisabledWakeWordProvider implements WakeWordProvider {
  readonly phrase = '';
  async start(): Promise<void> { return Promise.resolve(); }
  async stop(): Promise<void> { return Promise.resolve(); }
  onDetected(_callback: () => void): () => void { return () => undefined; }
}