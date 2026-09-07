export const permissionTypes = ['READ', 'WRITE', 'EXECUTE', 'DELETE', 'COMMUNICATE', 'LOCATION', 'MICROPHONE', 'CAMERA', 'SYSTEM_DIAGNOSTICS', 'DEVICE_ACCESS', 'NETWORK', 'MEMORY_ACCESS'] as const;
export type PermissionType = (typeof permissionTypes)[number];
export const permissionStates = ['GRANTED', 'DENIED', 'UNKNOWN'] as const;
export type PermissionState = (typeof permissionStates)[number];
export const permissionDurations = ['ONCE', 'SESSION', 'UNTIL_REVOKED'] as const;
export type PermissionDuration = (typeof permissionDurations)[number];
export const riskLevels = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export type RiskLevel = (typeof riskLevels)[number];
export const trustLevels = ['UNTRUSTED', 'LIMITED', 'TRUSTED'] as const;
export type TrustLevel = (typeof trustLevels)[number];
export const identityStates = ['UNKNOWN', 'VERIFIED', 'UNVERIFIED'] as const;
export type IdentityState = (typeof identityStates)[number];
export const authorizationResults = ['ALLOWED', 'DENIED', 'REQUIRES_PERMISSION', 'REQUIRES_CONFIRMATION'] as const;
export type AuthorizationResult = (typeof authorizationResults)[number];

export interface PermissionGrant {
  id: string;
  permission: PermissionType;
  state: PermissionState;
  scope?: string;
  duration: PermissionDuration;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredPermissions: PermissionType[];
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  supportsOffline: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRequest {
  capabilityId: string;
  permission: PermissionType;
  scope?: string;
  reason: string;
  riskLevel: RiskLevel;
  sessionId?: string;
  status: 'PENDING' | 'ALLOWED' | 'DENIED';
}

export interface ActionAuthorizationRequest {
  capabilityId: string;
  requestedPermissions?: PermissionType[];
  resource?: string;
  sessionId?: string;
  confirmed?: boolean;
}

export interface ActionAuthorization {
  result: AuthorizationResult;
  capabilityId: string;
  permissionStates: Partial<Record<PermissionType, PermissionState>>;
  reason: string;
  requiresConfirmation: boolean;
}

export interface ActionRecord {
  id: string;
  timestamp: string;
  sessionId?: string;
  capabilityId: string;
  resource?: string;
  result: AuthorizationResult;
  permissionState: PermissionState;
  confirmationRequired: boolean;
}

export interface PermissionBridge {
  listCapabilities: () => Promise<Capability[]>;
  listPermissions: () => Promise<PermissionGrant[]>;
  grant: (permission: PermissionType, scope: string | undefined, duration: PermissionDuration) => Promise<PermissionGrant>;
  deny: (permission: PermissionType, scope?: string) => Promise<PermissionGrant>;
  revoke: (id: string) => Promise<boolean>;
  check: (permission: PermissionType, scope?: string) => Promise<PermissionState>;
  authorize: (request: ActionAuthorizationRequest) => Promise<ActionAuthorization>;
  getTrust: () => Promise<{ trust: TrustLevel; identity: IdentityState }>;
}
