import type { TeshInteractionEngine } from '../../engine/teshInteractionEngine';
import { TeshApplicationError } from '../../engine/teshInteractionTypes';
import { VoiceError, type AudioState, type SpeechRecognitionProvider, type TTSProvider } from '../../../shared/voice';
import { MicrophoneService } from './microphoneService';

export interface VoiceSnapshot {
  microphone: ReturnType<MicrophoneService['getStatus']>;
  audio: AudioState;
  microphoneTest: boolean;
  recognition: 'idle' | 'listening' | 'error';
  tts: 'idle' | 'speaking' | 'error';
  interimTranscript: string;
  finalTranscript: string;
  error?: VoiceError;
}
type Listener = () => void;

export class VoiceController {
  private snapshot: VoiceSnapshot = { microphone: 'inactive', audio: { amplitude: 0, active: false }, microphoneTest: false, recognition: 'idle', tts: 'idle', interimTranscript: '', finalTranscript: '' };
  private readonly listeners = new Set<Listener>();
  private readonly unsubscribers: Array<() => void>;

  constructor(private readonly engine: TeshInteractionEngine, private readonly microphone: MicrophoneService, private readonly recognition: SpeechRecognitionProvider, private readonly tts: TTSProvider) {
    this.unsubscribers = [
      microphone.subscribe(() => { this.snapshot = { ...this.snapshot, microphone: microphone.getStatus(), audio: microphone.getAudio() }; engine.setAudio(microphone.getAudio()); this.notify(); }),
      recognition.onInterimResult((transcript) => { this.snapshot = { ...this.snapshot, interimTranscript: transcript }; this.notify(); }),
      recognition.onFinalResult((transcript) => { this.snapshot = { ...this.snapshot, finalTranscript: transcript, interimTranscript: '', recognition: 'idle' }; this.notify(); if (!this.snapshot.microphoneTest) this.finishListening(transcript); }),
      recognition.onError((error) => { this.snapshot = { ...this.snapshot, recognition: 'error', error }; this.notify(); void (this.snapshot.microphoneTest ? this.stopTestRecognition() : this.stopListening()); })
    ];
  }

  getSnapshot(): VoiceSnapshot { return this.snapshot; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async startListening(): Promise<void> {
    if (this.snapshot.microphone === 'active' || this.snapshot.recognition === 'listening' || this.snapshot.microphoneTest) return;
    this.snapshot = { ...this.snapshot, error: undefined, interimTranscript: '', finalTranscript: '' };
    try {
      if (!this.recognition.usesSystemMicrophone) await this.microphone.start();
      await this.recognition.start();
      this.engine.activate();
      this.snapshot = { ...this.snapshot, recognition: 'listening', microphone: this.recognition.usesSystemMicrophone ? 'active' : this.snapshot.microphone };
      this.notify();
    } catch (error) {
      if (!this.recognition.usesSystemMicrophone) await this.microphone.stop();
      const voiceError = error instanceof VoiceError ? error : new VoiceError('SPEECH_RECOGNITION_ERROR', 'Listening could not start.');
      this.snapshot = { ...this.snapshot, error: voiceError, recognition: 'error' };
      this.notify();
    }
  }

  async startMicrophoneTest(): Promise<void> {
    if (this.snapshot.microphoneTest) return;
    if (this.snapshot.microphone === 'active' || this.snapshot.recognition === 'listening') await this.stopListening();
    this.snapshot = { ...this.snapshot, microphoneTest: true, error: undefined, interimTranscript: '', finalTranscript: '', recognition: 'idle' };
    this.notify();
    try {
      if (!this.recognition.usesSystemMicrophone) await this.microphone.start();
      try {
        await this.recognition.start();
        this.snapshot = { ...this.snapshot, recognition: 'listening', microphone: this.recognition.usesSystemMicrophone ? 'active' : this.snapshot.microphone };
      } catch (error) {
        this.snapshot = { ...this.snapshot, recognition: 'idle', error: error instanceof VoiceError ? error : new VoiceError('SPEECH_RECOGNITION_UNAVAILABLE', 'Speech recognition is unavailable on this platform.') };
      }
      this.notify();
    } catch (error) {
      if (!this.recognition.usesSystemMicrophone) await this.microphone.stop();
      this.snapshot = { ...this.snapshot, microphoneTest: false, microphone: this.microphone.getStatus(), audio: this.microphone.getAudio(), error: error instanceof VoiceError ? error : new VoiceError('MICROPHONE_ACCESS_ERROR', 'Microphone access could not be started.') };
      this.notify();
    }
  }

  async stopMicrophoneTest(): Promise<void> {
    if (!this.snapshot.microphoneTest && this.snapshot.microphone === 'inactive') return;
    await this.stopTestRecognition();
    if (!this.recognition.usesSystemMicrophone) await this.microphone.stop();
    this.snapshot = { ...this.snapshot, microphoneTest: false, microphone: this.recognition.usesSystemMicrophone ? 'inactive' : this.microphone.getStatus(), audio: this.recognition.usesSystemMicrophone ? { amplitude: 0, active: false } : this.microphone.getAudio(), recognition: 'idle', interimTranscript: '' };
    this.notify();
  }

  async stopListening(): Promise<void> {
    await this.recognition.stop();
    if (!this.recognition.usesSystemMicrophone) await this.microphone.stop();
    if (this.engine.getContext().state === 'listening') this.engine.stopListening();
    this.snapshot = { ...this.snapshot, recognition: 'idle', microphone: 'inactive', audio: this.recognition.usesSystemMicrophone ? { amplitude: 0, active: false } : this.microphone.getAudio() };
    this.notify();
  }

  async speak(text: string): Promise<void> {
    try {
      if (this.engine.getContext().state === 'idle') { this.engine.activate(); this.engine.beginThinking(); }
      this.engine.beginSpeaking();
      this.snapshot = { ...this.snapshot, tts: 'speaking', error: undefined };
      this.notify();
      await this.tts.speak(text, { language: 'en-US', rate: 0.95, pitch: 1, volume: 0.9 });
      this.engine.completeSpeaking();
      this.snapshot = { ...this.snapshot, tts: 'idle' };
    } catch (error) {
      const voiceError = error instanceof VoiceError ? error : new VoiceError('TTS_ERROR', 'Speech synthesis failed.');
      this.snapshot = { ...this.snapshot, tts: 'error', error: voiceError };
      if (this.engine.getContext().state === 'speaking') this.engine.error(new TeshApplicationError(voiceError.code, voiceError.message));
    }
    this.notify();
  }

  async stopSpeaking(): Promise<void> { await this.tts.stop(); if (this.engine.getContext().state === 'speaking') this.engine.completeSpeaking(); this.snapshot = { ...this.snapshot, tts: 'idle' }; this.notify(); }
  simulateSpeaking(): void { if (this.engine.getContext().state === 'idle') { this.engine.activate(); this.engine.beginThinking(); } this.engine.beginSpeaking({ amplitude: 0.15 }); this.snapshot = { ...this.snapshot, tts: 'speaking' }; this.notify(); }
  async dispose(): Promise<void> { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); await this.stopMicrophoneTest(); await this.stopListening(); await this.stopSpeaking(); this.listeners.clear(); }

  private async stopTestRecognition(): Promise<void> { if (this.snapshot.recognition !== 'idle') await this.recognition.stop(); this.snapshot = { ...this.snapshot, recognition: 'idle' }; }
  private finishListening(transcript: string): void { if (this.engine.getContext().state === 'listening') { this.engine.beginThinking(); this.engine.setAudio({ amplitude: 0 }); } this.snapshot = { ...this.snapshot, finalTranscript: transcript, microphone: 'inactive', audio: { amplitude: 0, active: false } }; this.notify(); void this.microphone.stop(); }
  private notify(): void { this.listeners.forEach((listener) => listener()); }
}
