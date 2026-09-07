export interface NativeVoiceStatus {
  available: boolean;
  engine: 'openwakeword' | 'whisper' | 'speaker-verification' | 'unknown';
  message: string;
}
export interface NativeSpeakerAttempt { result: 'VERIFIED' | 'NOT_VERIFIED' | 'VERIFICATION_UNAVAILABLE'; confidence?: number; liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE'; method: string; }
export interface NativeWakeBridge {
  getStatus: () => Promise<NativeVoiceStatus>;
  start: (phrase: string) => Promise<void>;
  stop: () => Promise<void>;
  sendAudio: (samples: ArrayBuffer, sampleRate: number) => Promise<void>;
  onDetected: (callback: () => void) => () => void;
  enrollSpeaker: (sampleCount?: number) => Promise<void>;
  verifySpeaker: () => Promise<NativeSpeakerAttempt>;
  isSpeakerConfigured: () => Promise<boolean>;
  isSpeakerEnrolled: () => Promise<boolean>;
  clearSpeakerEnrollment: () => Promise<void>;
}
