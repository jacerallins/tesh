import type { TeshVisualState } from '../state/teshVisualState';

export type TeshEventType =
  | 'TESH_ACTIVATED'
  | 'LISTENING_STARTED'
  | 'LISTENING_STOPPED'
  | 'THINKING_STARTED'
  | 'PROCESSING_STARTED'
  | 'SPEAKING_STARTED'
  | 'PERMISSION_REQUESTED'
  | 'ACTION_COMPLETED'
  | 'ERROR_OCCURRED'
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'ONLINE'
  | 'OFFLINE';

export interface AudioState {
  amplitude: number;
  frequency?: number;
}

export interface PermissionRequest {
  id: string;
  capability: string;
  requestedAt: number;
}

export interface InteractionContext {
  state: TeshVisualState;
  previousState?: TeshVisualState;
  stateStartedAt: number;
  sessionId?: string;
  error?: TeshApplicationError;
  processingTask?: string;
  permissionRequest?: PermissionRequest;
  audio: AudioState;
}

export interface TeshEvent {
  type: TeshEventType;
  timestamp: number;
  sessionId?: string;
  error?: TeshApplicationError;
}

export class TeshApplicationError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.name = 'TeshApplicationError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

export interface TransitionResult {
  accepted: boolean;
  context: InteractionContext;
  error?: TeshApplicationError;
}

export interface SimulationTiming {
  listeningMs: number;
  thinkingMs: number;
  speakingMs: number;
}
