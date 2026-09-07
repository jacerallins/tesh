export interface NativeVoiceStatus {
  available: boolean;
  engine: 'openwakeword' | 'whisper' | 'unknown';
  message: string;
}

export interface NativeWakeBridge {
  getStatus: () => Promise<NativeVoiceStatus>;
  start: (phrase: string) => Promise<void>;
  stop: () => Promise<void>;
  sendAudio: (samples: ArrayBuffer, sampleRate: number) => Promise<void>;
  onDetected: (callback: () => void) => () => void;
}
