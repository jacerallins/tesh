import { VoiceError, type SpeechRecognitionProvider } from '../../../shared/voice';

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: { readonly length: number; readonly [index: number]: SpeechRecognitionResultLike };
  readonly resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export class BrowserSpeechRecognitionProvider implements SpeechRecognitionProvider {
  readonly name = 'Browser SpeechRecognition';
  readonly networkBehavior = 'The browser may send recognition audio to its configured speech service.';
  private recognition?: SpeechRecognitionLike;
  private interimListeners = new Set<(transcript: string) => void>();
  private finalListeners = new Set<(transcript: string) => void>();
  private errorListeners = new Set<(error: VoiceError) => void>();

  constructor(private readonly language = 'en-US') {}

  async start(): Promise<void> {
    if (this.recognition) return;
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Constructor) throw new VoiceError('SPEECH_RECOGNITION_UNAVAILABLE', 'Speech recognition is unavailable on this platform.');

    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = this.language;
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      const end = Math.min(event.results.length, event.resultIndex + 32);
      for (let index = event.resultIndex; index < end; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (result?.isFinal) final += transcript;
        else interim += transcript;
      }
      if (final.trim()) this.finalListeners.forEach((listener) => listener(final.trim()));
      if (interim.trim()) this.interimListeners.forEach((listener) => listener(interim.trim()));
    };
    recognition.onerror = () => this.errorListeners.forEach((listener) => listener(new VoiceError('SPEECH_RECOGNITION_ERROR', 'Speech recognition encountered an error.')));
    recognition.onend = () => { if (this.recognition === recognition) this.recognition = undefined; };
    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      if (this.recognition === recognition) this.recognition = undefined;
      throw new VoiceError('SPEECH_RECOGNITION_ERROR', 'Speech recognition could not start.');
    }
  }

  async stop(): Promise<void> {
    const recognition = this.recognition;
    this.recognition = undefined;
    recognition?.stop();
  }

  async cancel(): Promise<void> {
    const recognition = this.recognition;
    this.recognition = undefined;
    recognition?.abort();
  }

  onInterimResult(callback: (transcript: string) => void): () => void { this.interimListeners.add(callback); return () => this.interimListeners.delete(callback); }
  onFinalResult(callback: (transcript: string) => void): () => void { this.finalListeners.add(callback); return () => this.finalListeners.delete(callback); }
  onError(callback: (error: VoiceError) => void): () => void { this.errorListeners.add(callback); return () => this.errorListeners.delete(callback); }
}