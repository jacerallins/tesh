import { VoiceError, type TTSOptions, type TTSProvider } from '../../../shared/voice';

export class BrowserTTSProvider implements TTSProvider {
  readonly name = 'Browser SpeechSynthesis';
  private readonly synthesis = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  private cancellationGeneration = 0;

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const synthesis = this.synthesis;
    if (!synthesis) throw new VoiceError('TTS_UNAVAILABLE', 'Speech synthesis is unavailable on this platform.');
    if (!text.trim()) return;

    const generation = this.cancellationGeneration;
    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.language ?? 'en-US';
      utterance.rate = options.rate ?? 0.95;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 0.9;
      if (options.voice) utterance.voice = Array.from(synthesis.getVoices()).find((voice) => voice.name === options.voice) ?? null;
      utterance.onend = () => resolve();
      utterance.onerror = () => {
        if (generation !== this.cancellationGeneration) resolve();
        else reject(new VoiceError('TTS_ERROR', 'Speech synthesis could not complete.'));
      };
      synthesis.speak(utterance);
    });
  }

  async stop(): Promise<void> {
    this.cancellationGeneration += 1;
    this.synthesis?.cancel();
  }
  async pause(): Promise<void> { this.synthesis?.pause(); }
  async resume(): Promise<void> { this.synthesis?.resume(); }
}
