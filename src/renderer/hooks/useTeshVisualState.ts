import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TeshVisualState } from '../state/teshVisualState';
import { TeshInteractionEngine } from '../engine/teshInteractionEngine';
import type { AudioState, PermissionRequest, TeshApplicationError, TransitionResult } from '../engine/teshInteractionTypes';
import { MicrophoneService } from '../services/voice/microphoneService';
import { BrowserSpeechRecognitionProvider } from '../services/voice/speechRecognitionProvider';
import { BrowserTTSProvider } from '../services/voice/ttsProvider';
import { VoiceController } from '../services/voice/voiceController';
import { DevelopmentSpeakerVerificationProvider } from '../services/voice/speakerVerificationProvider';
import { ProductionSpeakerVerificationProvider } from '../services/voice/productionSpeakerVerificationProvider';
import { NativeSpeakerVerificationProvider } from '../services/voice/nativeSpeakerVerificationProvider';
import { DevelopmentWakeWordProvider, WakeWordService } from '../services/voice/wakeWordService';
import { ProductionWakeWordProvider } from '../services/voice/productionWakeWordProvider';
import { NativeWakeWordProvider } from '../services/voice/nativeWakeWordProvider';
import { VoiceActivationService } from '../services/voice/voiceActivationService';

export interface TeshVisualStateController {
  state: TeshVisualState; sessionId?: string; audio: AudioState;
  activate: () => TransitionResult; beginListening: () => TransitionResult; stopListening: () => TransitionResult; beginThinking: () => TransitionResult; beginProcessing: (task?: string) => TransitionResult; beginSpeaking: (audio?: AudioState) => TransitionResult;
  requestPermission: (request: PermissionRequest) => TransitionResult; resolvePermission: (granted: boolean) => TransitionResult; success: () => TransitionResult; error: (error: TeshApplicationError) => TransitionResult; goOffline: () => TransitionResult; goOnline: () => TransitionResult; reset: () => TransitionResult;
  simulateInteraction: () => void; simulateState: (state: TeshVisualState) => TransitionResult; voice: VoiceController; voiceSnapshot: ReturnType<VoiceController['getSnapshot']>; activation: VoiceActivationService; activationSnapshot: ReturnType<VoiceActivationService['getSnapshot']>;
}

export function useTeshVisualState(initialState: TeshVisualState = 'idle'): TeshVisualStateController {
  const [engine] = useState(() => { const instance = new TeshInteractionEngine(); if (initialState !== 'idle') instance.simulateState(initialState); return instance; });
  const context = useSyncExternalStore((listener) => engine.subscribe(listener), () => engine.getContext(), () => engine.getContext());
  const [voice] = useState(() => new VoiceController(engine, new MicrophoneService(() => window.tesh?.permissions), new BrowserSpeechRecognitionProvider(), new BrowserTTSProvider()));
  const voiceSnapshot = useSyncExternalStore((listener) => voice.subscribe(listener), () => voice.getSnapshot(), () => voice.getSnapshot());
  const [activation] = useState(() => {
    const useNative = import.meta.env.VITE_TESH_NATIVE_VOICE === 'true';
    const wakeProvider = useNative ? new NativeWakeWordProvider('Tesh Pineapples') : (import.meta.env.DEV ? new DevelopmentWakeWordProvider('Tesh Pineapples') : new ProductionWakeWordProvider('Tesh Pineapples'));
    const speakerProvider = useNative ? new NativeSpeakerVerificationProvider() : (import.meta.env.DEV ? new DevelopmentSpeakerVerificationProvider() : new ProductionSpeakerVerificationProvider());
    return new VoiceActivationService(engine, voice, new WakeWordService(wakeProvider), speakerProvider);
  });
  const activationSnapshot = useSyncExternalStore((listener) => activation.subscribe(listener), () => activation.getSnapshot(), () => activation.getSnapshot());
  useEffect(() => { const cleanup = (): void => { void activation.stop(); void voice.dispose(); }; window.addEventListener('beforeunload', cleanup); return () => { window.removeEventListener('beforeunload', cleanup); cleanup(); }; }, [activation, voice]);
  return { state: context.state, sessionId: context.sessionId, audio: context.audio, activate: engine.activate.bind(engine), beginListening: engine.beginListening.bind(engine), stopListening: engine.stopListening.bind(engine), beginThinking: engine.beginThinking.bind(engine), beginProcessing: engine.beginProcessing.bind(engine), beginSpeaking: engine.beginSpeaking.bind(engine), requestPermission: engine.requestPermission.bind(engine), resolvePermission: engine.resolvePermission.bind(engine), success: engine.success.bind(engine), error: engine.error.bind(engine), goOffline: engine.goOffline.bind(engine), goOnline: engine.goOnline.bind(engine), reset: engine.reset.bind(engine), simulateInteraction: engine.simulateInteraction.bind(engine), simulateState: engine.simulateState.bind(engine), voice, voiceSnapshot, activation, activationSnapshot };
}
