export type CompanionDeviceStatus = 'PENDING' | 'PAIRED' | 'CONNECTED' | 'DISCONNECTED' | 'REVOKED';
export type CompanionMessageType = 'PAIRING_CHALLENGE_REQUEST' | 'PAIRING_CHALLENGE_RESPONSE' | 'PAIR_REQUEST' | 'PAIR_RESPONSE' | 'AUTH_REQUEST' | 'AUTH_RESPONSE' | 'PING' | 'PONG' | 'STATE_UPDATE' | 'COMMAND_REQUEST' | 'COMMAND_RESPONSE' | 'SYNC_PUSH' | 'SYNC_ACK' | 'NOTIFICATION' | 'ERROR';
export type CompanionPermission = 'COMPANION_VIEW_STATUS' | 'COMPANION_SEND_COMMAND' | 'COMPANION_RECEIVE_NOTIFICATIONS' | 'COMPANION_SYNC_MEMORY' | 'COMPANION_SYNC_CONVERSATIONS' | 'COMPANION_SYNC_ROUTINES' | 'COMPANION_CHAT';
export type CompanionPlatform = 'ANDROID' | 'IOS' | 'WINDOWS' | 'MACOS' | 'LINUX' | 'UNKNOWN';
export interface CompanionDevice { id: string; name: string; platform: CompanionPlatform; deviceType: string; publicKey: string; status: CompanionDeviceStatus; createdAt: string; lastSeenAt?: string; permissions: CompanionPermission[]; revokedAt?: string; }
export interface PairingChallenge { challengeId: string; code: string; expiresAt: string; }
export interface CompanionMessage<T = unknown> { messageId: string; deviceId: string; type: CompanionMessageType; timestamp: string; requestId: string; payload: T; signature?: string; }
export interface CompanionSession { sessionId: string; deviceId: string; expiresAt: string; }
export interface CompanionSnapshot { devices: CompanionDevice[]; pairing?: PairingChallenge; connectionState: 'OFFLINE' | 'CONNECTED'; }
export interface CompanionBridge { getSnapshot: () => Promise<CompanionSnapshot>; createPairingChallenge: () => Promise<PairingChallenge>; pair: (input: PairInput) => Promise<CompanionDevice>; disconnect: (deviceId: string) => Promise<void>; revoke: (deviceId: string) => Promise<void>; grantPermission: (deviceId: string, permission: CompanionPermission) => Promise<CompanionDevice>; }
export interface PairInput { challengeId: string; code: string; name: string; platform: CompanionPlatform; deviceType: string; publicKey: string; signature: string; }
