import { VoiceError, type SpeechRecognitionProvider } from '../../../shared/voice';

interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionResultListLike { length: number; [index: number]: SpeechRecognitionResultLike; }
interface SpeechRecognitionEventLike extends Event { results: SpeechRecognitionResultListLike; resultIndex: number; }
interface SpeechRecognitionErrorEventLike extends Event { error?: string; message?: string; }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const recognitionErrorMessages: Record<string, string> = {
  'not-allowed': 'Microphone or speech recognition permission was denied.',
  'service-not-allowed': 'The speech recognition service is not allowed for this app.',
  'audio-capture': 'No usable microphone audio could be captured.',
  network: 'The browser speech service could not be reached. Check your internet connection.',
  'no-speech': 'No speech was detected. Try speaking a little closer to the microphone.',
  aborted: 'Speech recognition was stopped before a result was returned.'
};

export class BrowserSpeechRecognitionProvider implements SpeechRecognitionProvider {
  readonly name = 'Browser SpeechRecognition';
  readonly networkBehavior = 'The browser may send recognition audio to its configured speech service.';
  readonly usesSystemMicrophone = false;
  private recognition?: SpeechRecognitionLike;
  private interimListeners = new Set<(transcript: string) => void>();
  private finalListeners = new Set<(transcript: string) => void>();
  private errorListeners = new Set<(error: VoiceError) => void>();

  constructor(private readonly language = 'en-US') {}

  async start(): Promise<void> {
    if (this.recognition) return;
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Constructor) throw new VoiceError('SPEECH_RECOGNITION_UNAVAILABLE', 'Speech recognition is not supported by this Electron runtime. Microphone access can still work, but a native speech provider is required for transcription.');
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = this.language;
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (result?.isFinal) final += transcript; else interim += transcript;
      }
      if (final.trim()) this.finalListeners.forEach((listener) => listener(final.trim()));
      if (interim.trim()) this.interimListeners.forEach((listener) => listener(interim.trim()));
    };
    recognition.onerror = (event) => {
      const code = event.error ?? 'unknown';
      const message = recognitionErrorMessages[code] ?? event.message ?? `Speech recognition failed (${code}).`;
      this.errorListeners.forEach((listener) => listener(new VoiceError('SPEECH_RECOGNITION_ERROR', message)));
    };
    recognition.onend = () => { if (this.recognition === recognition) this.recognition = undefined; };
    this.recognition = recognition;
    try { recognition.start(); } catch { this.recognition = undefined; throw new VoiceError('SPEECH_RECOGNITION_ERROR', 'Speech recognition could not start.'); }
  }
  async stop(): Promise<void> { const recognition = this.recognition; this.recognition = undefined; recognition?.stop(); }
  async cancel(): Promise<void> { const recognition = this.recognition; this.recognition = undefined; recognition?.abort(); }
  onInterimResult(callback: (transcript: string) => void): () => void { this.interimListeners.add(callback); return () => this.interimListeners.delete(callback); }
  onFinalResult(callback: (transcript: string) => void): () => void { this.finalListeners.add(callback); return () => this.finalListeners.delete(callback); }
  onError(callback: (error: VoiceError) => void): () => void { this.errorListeners.add(callback); return () => this.errorListeners.delete(callback); }
}
