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
  voice?: import('./voice/nativeTypes').NativeWakeBridge;
  memory: import('./memoryTypes').MemoryBridge;
  permissions: import('./permissionTypes').PermissionBridge;
  system: import('./systemTypes').SystemToolsBridge;
  conversation: import('./aiTypes').AIConversationBridge;
  communication: import('./communicationTypes').CommunicationBridge;
  diagnostics?: import('./diagnosticsTypes').DiagnosticsBridge;
  companion?: import('./companionTypes').CompanionBridge;
}
