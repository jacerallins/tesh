import os from 'node:os';
import type { SystemDiagnostics } from '../../shared/systemTypes';
import type { PermissionService } from '../permissions/permissionService';
import type { FileErrorCode } from '../../shared/systemTypes';

export class SystemServiceError extends Error {
  readonly code: FileErrorCode = 'SYSTEM_INFORMATION_UNAVAILABLE';
  constructor(message: string) { super(message); this.name = 'SystemServiceError'; }
}

export class SystemService {
  constructor(private readonly appVersion: string, private readonly permissions: PermissionService, private readonly isVerified: () => boolean, private readonly audit: (event: string) => void = () => undefined) {}
  getDiagnostics(): SystemDiagnostics { if (!this.isVerified() || this.permissions.authorizeAction({ capabilityId: 'system.diagnostics', resource: 'system' }).result !== 'ALLOWED') throw new SystemServiceError('System diagnostics are not authorized.'); try { const diagnostics = { platform: process.platform, architecture: process.arch, hostname: os.hostname(), cpuCount: os.cpus().length, memoryTotal: os.totalmem(), memoryFree: os.freemem(), uptimeSeconds: os.uptime(), appVersion: this.appVersion }; this.audit('SYSTEM_DIAGNOSTICS_REQUESTED'); return diagnostics; } catch { throw new SystemServiceError('System diagnostics are unavailable.'); } }
}