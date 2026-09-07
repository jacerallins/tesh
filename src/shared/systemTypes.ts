export type FileCapability = 'FILE_READ' | 'FILE_DISPLAY' | 'FILE_CREATE' | 'FILE_RENAME' | 'FILE_MOVE' | 'FILE_DELETE';
export type DeleteMode = 'MOVE_TO_TRASH';
export type FileErrorCode = 'FILE_NOT_FOUND' | 'FILE_ACCESS_DENIED' | 'FILE_OUTSIDE_SCOPE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE' | 'FILE_ALREADY_EXISTS' | 'INVALID_PATH' | 'DELETE_REQUIRES_CONFIRMATION' | 'SYSTEM_INFORMATION_UNAVAILABLE';
export interface FileResultMeta { capability: FileCapability; permissionResult: string; resourceScope: string; authorizationResult: string; confirmationRequired: boolean; }
export interface FileTextResult { path: string; content: string; size: number; meta: FileResultMeta; }
export interface FileActionResult { path: string; meta: FileResultMeta; mode?: DeleteMode; }
export interface FileSearchResult { path: string; name: string; size: number; isDirectory: boolean; }
export interface FileSearchOptions { root: string; query?: string; extensions?: string[]; limit?: number; offset?: number; }
export interface FileCreateInput { path: string; content: string; }
export interface FileMoveInput { source: string; destination: string; confirmed?: boolean; }
export interface FileDeleteInput { path: string; confirmed?: boolean; }
export interface SystemDiagnostics { platform: string; architecture: string; hostname: string; cpuCount: number; memoryTotal: number; memoryFree: number; uptimeSeconds: number; appVersion: string; }
export interface SystemToolsBridge { search: (options: FileSearchOptions) => Promise<FileSearchResult[]>; read: (path: string) => Promise<FileTextResult>; display: (path: string) => Promise<FileActionResult>; create: (input: FileCreateInput) => Promise<FileActionResult>; rename: (input: FileMoveInput) => Promise<FileActionResult>; move: (input: FileMoveInput) => Promise<FileActionResult>; delete: (input: FileDeleteInput) => Promise<FileActionResult>; diagnostics: () => Promise<SystemDiagnostics>; setDevelopmentSession: (verified: boolean) => Promise<void>; }