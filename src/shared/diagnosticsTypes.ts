export type FailureComponent = 'AI' | 'VOICE' | 'TTS' | 'MEMORY' | 'FILESYSTEM' | 'COMMUNICATION' | 'PERMISSIONS';

export interface AuditEvent {
  id: number;
  event: string;
  resource?: string;
  createdAt: string;
}

export interface DiagnosticsSnapshot {
  interactionState: string;
  verifiedSession: boolean;
  activePermissions: string[];
  conversationStatus: string;
  memoryAccess: string;
  aiProvider: string;
  activeToolRequest?: string;
  authorizationResult?: string;
  confirmationState?: string;
  voiceState: string;
  lastError?: string;
  lastAuditEvent?: AuditEvent;
  failureInjection: Partial<Record<FailureComponent, boolean>>;
  auditEvents: AuditEvent[];
}

export interface DiagnosticsBridge {
  getSnapshot: () => Promise<DiagnosticsSnapshot>;
  setFailure: (component: FailureComponent, enabled: boolean) => Promise<DiagnosticsSnapshot>;
}