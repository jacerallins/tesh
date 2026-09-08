export type AppState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'processing'
  | 'permission-request'
  | 'success'
  | 'error'
  | 'offline';

export interface RuntimeStatus {
  platform: string;
  appVersion: string;
  isPackaged: boolean;
}

export interface NativeSpeechBridge {
  isAvailable: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onFinal: (callback: (transcript: string) => void) => () => void;
  onError: (callback: (message: string) => void) => () => void;
}

export interface TeshBridge {
  getRuntimeStatus: () => Promise<RuntimeStatus>;
  assistant: {
    show: () => void;
    hide: () => void;
    updateState: (state: string, amplitude: number) => void;
    onActivate: (callback: () => void) => () => void;
    onPause: (callback: (paused: boolean) => void) => () => void;
    onState: (callback: (state: { state: string; amplitude: number }) => void) => () => void;
  };
  nativeSpeech?: NativeSpeechBridge;
  memory: import('./memoryTypes').MemoryBridge;
  permissions: import('./permissionTypes').PermissionBridge;
  system: import('./systemTypes').SystemToolsBridge;
  conversation: import('./aiTypes').AIConversationBridge;
  communication: import('./communicationTypes').CommunicationBridge;
  diagnostics?: import('./diagnosticsTypes').DiagnosticsBridge;
  companion?: import('./companionTypes').CompanionBridge;
}
