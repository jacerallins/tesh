import { describe, expect, it, vi } from 'vitest';
import { TeshInteractionEngine } from '../../engine/teshInteractionEngine';
import type { MicrophoneService } from './microphoneService';
import { VoiceController } from './voiceController';
import { VoiceError, type AudioState, type SpeechRecognitionProvider, type TTSOptions, type TTSProvider } from '../../../shared/voice';

class FakeMicrophone {
  status: 'inactive' | 'active' = 'inactive';
  audio: AudioState = { amplitude: 0.2, active: false };
  private listeners = new Set<() => void>();
  getStatus(): 'inactive' | 'active' { return this.status; }
  getAudio(): AudioState { return { ...this.audio, active: this.status === 'active' }; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async start(): Promise<void> { this.status = 'active'; this.listeners.forEach((listener) => listener()); }
  async stop(): Promise<void> { this.status = 'inactive'; this.listeners.forEach((listener) => listener()); }
  async dispose(): Promise<void> { await this.stop(); }
}

class FakeRecognition implements SpeechRecognitionProvider {
  readonly name = 'fake';
  readonly networkBehavior = 'none';
  shouldFailStart = false;
  stopCalls = 0;
  private finalListeners = new Set<(text: string) => void>();
  private errorListeners = new Set<(error: VoiceError) => void>();
  async start(): Promise<void> { if (this.shouldFailStart) throw new VoiceError('SPEECH_RECOGNITION_UNAVAILABLE', 'Speech recognition is unavailable.'); }
  async stop(): Promise<void> { this.stopCalls += 1; }
  async cancel(): Promise<void> { return Promise.resolve(); }
  onInterimResult(_callback: (text: string) => void): () => void { return () => undefined; }
  onFinalResult(callback: (text: string) => void): () => void { this.finalListeners.add(callback); return () => this.finalListeners.delete(callback); }
  onError(callback: (error: VoiceError) => void): () => void { this.errorListeners.add(callback); return () => this.errorListeners.delete(callback); }
  emitFinal(text: string): void { this.finalListeners.forEach((listener) => listener(text)); }
  emitError(error: VoiceError): void { this.errorListeners.forEach((listener) => listener(error)); }
}

class FakeTTS implements TTSProvider {
  readonly name = 'fake';
  calls: string[] = [];
  async speak(text: string, _options?: TTSOptions): Promise<void> { this.calls.push(text); }
  async stop(): Promise<void> { return Promise.resolve(); }
}

describe('VoiceController', () => {
  it('keeps microphone lifecycle behind the service and leaves final text in thinking', async () => {
    const engine = new TeshInteractionEngine();
    const microphone = new FakeMicrophone();
    const recognition = new FakeRecognition();
    const controller = new VoiceController(engine, microphone as unknown as MicrophoneService, recognition, new FakeTTS());
    await controller.startListening();
    expect(engine.getContext().state).toBe('listening');
    recognition.emitFinal('Hello Tesh.');
    expect(controller.getSnapshot().finalTranscript).toBe('Hello Tesh.');
    expect(engine.getContext().state).toBe('thinking');
    await controller.dispose();
    expect(microphone.status).toBe('inactive');
  });

  it('does not duplicate starts and completes TTS through speaking to idle', async () => {
    const engine = new TeshInteractionEngine();
    const microphone = new FakeMicrophone();
    const recognition = new FakeRecognition();
    const tts = new FakeTTS();
    const controller = new VoiceController(engine, microphone as unknown as MicrophoneService, recognition, tts);
    await controller.startListening();
    await controller.startListening();
    await controller.stopListening();
    await controller.speak('Hello Tesh.');
    expect(tts.calls).toEqual(['Hello Tesh.']);
    expect(engine.getContext().state).toBe('idle');
    await controller.dispose();
  });

  it('runs a microphone test without sending speech to the listening engine', async () => {
    const engine = new TeshInteractionEngine();
    const microphone = new FakeMicrophone();
    const recognition = new FakeRecognition();
    const controller = new VoiceController(engine, microphone as unknown as MicrophoneService, recognition, new FakeTTS());
    await controller.startMicrophoneTest();
    expect(controller.getSnapshot().microphoneTest).toBe(true);
    expect(controller.getSnapshot().microphone).toBe('active');
    recognition.emitFinal('test words');
    expect(controller.getSnapshot().finalTranscript).toBe('test words');
    expect(engine.getContext().state).toBe('idle');
    await controller.stopMicrophoneTest();
    expect(controller.getSnapshot().microphoneTest).toBe(false);
    expect(microphone.status).toBe('inactive');
    await controller.dispose();
  });

  it('keeps microphone audio active when speech recognition is unavailable', async () => {
    const engine = new TeshInteractionEngine();
    const microphone = new FakeMicrophone();
    const recognition = new FakeRecognition();
    recognition.shouldFailStart = true;
    const controller = new VoiceController(engine, microphone as unknown as MicrophoneService, recognition, new FakeTTS());
    await controller.startMicrophoneTest();
    expect(controller.getSnapshot().microphoneTest).toBe(true);
    expect(controller.getSnapshot().microphone).toBe('active');
    expect(controller.getSnapshot().error?.code).toBe('SPEECH_RECOGNITION_UNAVAILABLE');
    await controller.stopMicrophoneTest();
    expect(microphone.status).toBe('inactive');
    await controller.dispose();
  });

  it('surfaces a typed recognition error and cleans up listening', async () => {
    const engine = new TeshInteractionEngine();
    const microphone = new FakeMicrophone();
    const recognition = new FakeRecognition();
    const controller = new VoiceController(engine, microphone as unknown as MicrophoneService, recognition, new FakeTTS());
    await controller.startListening();
    recognition.emitError(new VoiceError('SPEECH_RECOGNITION_ERROR', 'Recognition failed.'));
    await vi.waitFor(() => expect(microphone.status).toBe('inactive'));
    expect(controller.getSnapshot().error?.code).toBe('SPEECH_RECOGNITION_ERROR');
    await controller.dispose();
  });
});