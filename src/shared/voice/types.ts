import type { PermissionBridge } from '../permissionTypes';

export type MicrophoneStatus = 'inactive' | 'starting' | 'active' | 'error';
export type SpeechRecognitionStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';
export type TTSStatus = 'idle' | 'speaking' | 'paused' | 'error';

export interface AudioState {
  amplitude: number;
  sampleRate?: number;
  channelCount?: number;
  inputDevice?: string;
  active: boolean;
}

export interface TTSOptions {
  voice?: string;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export type VoiceErrorCode =
  | 'WAKE_WORD_UNAVAILABLE'
  | 'MICROPHONE_PERMISSION_DENIED'
  | 'MICROPHONE_UNAVAILABLE'
  | 'MICROPHONE_ACCESS_ERROR'
  | 'SPEECH_RECOGNITION_UNAVAILABLE'
  | 'SPEECH_RECOGNITION_ERROR'
  | 'TTS_UNAVAILABLE'
  | 'TTS_ERROR';

export class VoiceError extends Error {
  readonly code: VoiceErrorCode;

  constructor(code: VoiceErrorCode, message: string) {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
  }
}

export interface WakeWordProvider {
  readonly phrase: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onDetected(callback: () => void): () => void;
}

export interface SpeechRecognitionProvider {
  readonly name: string;
  readonly networkBehavior: string;
  readonly usesSystemMicrophone: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  onInterimResult(callback: (transcript: string) => void): () => void;
  onFinalResult(callback: (transcript: string) => void): () => void;
  onError(callback: (error: VoiceError) => void): () => void;
}

export interface TTSProvider {
  readonly name: string;
  speak(text: string, options?: TTSOptions): Promise<void>;
  stop(): Promise<void>;
  pause?(): Promise<void>;
  resume?(): Promise<void>;
}

export type PermissionBridgeProvider = () => PermissionBridge | undefined;
