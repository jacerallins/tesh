import type { DiagnosticsSnapshot, FailureComponent } from '../shared/diagnosticsTypes';
import type { AuditService } from './auditService';

export class DiagnosticsService {
  private readonly failures = new Set<FailureComponent>();
  private snapshot: DiagnosticsSnapshot = {
    interactionState: 'idle', verifiedSession: false, activePermissions: [], conversationStatus: 'IDLE',
    memoryAccess: 'UNKNOWN', aiProvider: 'unavailable', confirmationState: 'none', voiceState: 'idle', failureInjection: {}, auditEvents: []
  };

  constructor(private readonly audit: AuditService) {}

  getSnapshot(): DiagnosticsSnapshot {
    return { ...this.snapshot, failureInjection: Object.fromEntries([...this.failures].map((component) => [component, true])), auditEvents: this.audit.list() };
  }

  setFailure(component: FailureComponent, enabled: boolean): DiagnosticsSnapshot {
    if (enabled) this.failures.add(component); else this.failures.delete(component);
    this.audit.record('FAILURE_INJECTION_CHANGED', component);
    return this.getSnapshot();
  }

  shouldFail(component: FailureComponent): boolean { return this.failures.has(component); }
  update(patch: Partial<DiagnosticsSnapshot>): void { this.snapshot = { ...this.snapshot, ...patch }; }
}