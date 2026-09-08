import { VoiceError, type SpeechRecognitionProvider } from '../../../shared/voice';

export class NativeWindowsSpeechRecognitionProvider implements SpeechRecognitionProvider {
  readonly name = 'Windows native SpeechRecognition';
  readonly networkBehavior = 'Local Windows speech recognition. Tesh does not send microphone audio to a browser speech service.';
  readonly usesSystemMicrophone = true;
  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    const bridge = window.tesh?.nativeSpeech;
    if (!bridge) return;
    this.unsubscribers.push(bridge.onFinal((transcript) => this.finalListeners.forEach((listener) => listener(transcript))));
    this.unsubscribers.push(bridge.onError((message) => this.errorListeners.forEach((listener) => listener(new VoiceError('SPEECH_RECOGNITION_ERROR', message)))));
  }

  private readonly interimListeners = new Set<(transcript: string) => void>();
  private readonly finalListeners = new Set<(transcript: string) => void>();
  private readonly errorListeners = new Set<(error: VoiceError) => void>();

  async start(): Promise<void> {
    const bridge = window.tesh?.nativeSpeech;
    if (!bridge) throw new VoiceError('SPEECH_RECOGNITION_UNAVAILABLE', 'Native Windows speech is unavailable.');
    try { await bridge.start(); }
    catch (error) { throw new VoiceError('SPEECH_RECOGNITION_ERROR', error instanceof Error ? error.message : 'Windows speech recognition could not start.'); }
  }

  async stop(): Promise<void> { await window.tesh?.nativeSpeech?.stop(); }
  async cancel(): Promise<void> { await window.tesh?.nativeSpeech?.stop(); }
  onInterimResult(callback: (transcript: string) => void): () => void { this.interimListeners.add(callback); return () => this.interimListeners.delete(callback); }
  onFinalResult(callback: (transcript: string) => void): () => void { this.finalListeners.add(callback); return () => this.finalListeners.delete(callback); }
  onError(callback: (error: VoiceError) => void): () => void { this.errorListeners.add(callback); return () => this.errorListeners.delete(callback); }
  dispose(): void { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.unsubscribers.length = 0; }
}
