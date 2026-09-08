import { contextBridge, ipcRenderer } from 'electron';
import type { TeshBridge } from '../shared/types';

const bridge: TeshBridge = {
  getRuntimeStatus: () => ipcRenderer.invoke('runtime:get-status'),
  assistant: {
    show: () => { void ipcRenderer.invoke('assistant:show'); },
    hide: () => { void ipcRenderer.invoke('assistant:hide'); },
    updateState: (state, amplitude) => { void ipcRenderer.invoke('assistant:update-state', { state, amplitude }); },
    onActivate: (callback) => { const listener = (): void => callback(); ipcRenderer.on('assistant:activate', listener); return () => ipcRenderer.removeListener('assistant:activate', listener); },
    onPause: (callback) => { const listener = (_event: Electron.IpcRendererEvent, paused: boolean): void => callback(paused); ipcRenderer.on('assistant:voice-pause', listener); return () => ipcRenderer.removeListener('assistant:voice-pause', listener); },
    onState: (callback) => { const listener = (_event: Electron.IpcRendererEvent, value: { state: string; amplitude: number }): void => callback(value); ipcRenderer.on('assistant:state', listener); return () => ipcRenderer.removeListener('assistant:state', listener); }
  },
  nativeSpeech: {
    isAvailable: () => ipcRenderer.invoke('voice:native-available'),
    start: () => ipcRenderer.invoke('voice:native-start'),
    stop: () => ipcRenderer.invoke('voice:native-stop'),
    onFinal: (callback) => { const listener = (_event: Electron.IpcRendererEvent, transcript: string): void => callback(transcript); ipcRenderer.on('voice:native-final', listener); return () => ipcRenderer.removeListener('voice:native-final', listener); },
    onError: (callback) => { const listener = (_event: Electron.IpcRendererEvent, message: string): void => callback(message); ipcRenderer.on('voice:native-error', listener); return () => ipcRenderer.removeListener('voice:native-error', listener); }
  },
  memory: {
    create: (input) => ipcRenderer.invoke('memory:create', input), get: (id) => ipcRenderer.invoke('memory:get', id), update: (id, input) => ipcRenderer.invoke('memory:update', id, input), delete: (id) => ipcRenderer.invoke('memory:delete', id), list: (options) => ipcRenderer.invoke('memory:list', options), search: (options) => ipcRenderer.invoke('memory:search', options), archive: (id) => ipcRenderer.invoke('memory:archive', id), restore: (id) => ipcRenderer.invoke('memory:restore', id),
    intelligence: { createCandidate: (input, privacy) => ipcRenderer.invoke('memory:candidate-create', input, privacy), listCandidates: () => ipcRenderer.invoke('memory:candidates'), approveCandidate: (id) => ipcRenderer.invoke('memory:candidate-approve', id), rejectCandidate: (id) => ipcRenderer.invoke('memory:candidate-reject', id), retrieveRelevant: (query) => ipcRenderer.invoke('memory:retrieve-relevant', query), createStyleProfile: (input) => ipcRenderer.invoke('memory:style-create', input), listStyleProfiles: () => ipcRenderer.invoke('memory:styles') }
  },
  permissions: { listCapabilities: () => ipcRenderer.invoke('permission:capabilities'), listPermissions: () => ipcRenderer.invoke('permission:list'), grant: (permission, scope, duration) => ipcRenderer.invoke('permission:grant', permission, scope, duration), deny: (permission, scope) => ipcRenderer.invoke('permission:deny', permission, scope), revoke: (id) => ipcRenderer.invoke('permission:revoke', id), check: (permission, scope) => ipcRenderer.invoke('permission:check', permission, scope), authorize: (request) => ipcRenderer.invoke('permission:authorize', request), getTrust: () => ipcRenderer.invoke('permission:trust') },
  system: { search: (options) => ipcRenderer.invoke('system:search', options), read: (filePath) => ipcRenderer.invoke('system:read', filePath), display: (filePath) => ipcRenderer.invoke('system:display', filePath), create: (input) => ipcRenderer.invoke('system:create', input), rename: (input) => ipcRenderer.invoke('system:rename', input), move: (input) => ipcRenderer.invoke('system:move', input), delete: (input) => ipcRenderer.invoke('system:delete', input), diagnostics: () => ipcRenderer.invoke('system:diagnostics'), setDevelopmentSession: (verified) => ipcRenderer.invoke('system:set-development-session', verified) },
  conversation: { start: () => ipcRenderer.invoke('conversation:start'), send: (conversationId, content) => ipcRenderer.invoke('conversation:send', conversationId, content), cancel: (conversationId) => ipcRenderer.invoke('conversation:cancel', conversationId), confirmTool: (conversationId, requestId, approved) => ipcRenderer.invoke('conversation:confirm-tool', conversationId, requestId, approved), getConfig: () => ipcRenderer.invoke('conversation:config'), getStatus: () => ipcRenderer.invoke('conversation:status') },
  communication: { getContacts: () => ipcRenderer.invoke('communication:contacts'), resolveRecipient: (query) => ipcRenderer.invoke('communication:resolve', query), createDraft: (input) => ipcRenderer.invoke('communication:draft-create', input), updateDraft: (id, content) => ipcRenderer.invoke('communication:draft-update', id, content), confirmSend: (id, approved) => ipcRenderer.invoke('communication:send-confirm', id, approved), cancelDraft: (id) => ipcRenderer.invoke('communication:draft-cancel', id), getSnapshot: () => ipcRenderer.invoke('communication:snapshot') },
  diagnostics: { getSnapshot: () => ipcRenderer.invoke('diagnostics:snapshot'), setFailure: (component, enabled) => ipcRenderer.invoke('diagnostics:set-failure', component, enabled) },
  companion: { getSnapshot: () => ipcRenderer.invoke('companion:snapshot'), createPairingChallenge: () => ipcRenderer.invoke('companion:pairing-create'), pair: (input) => ipcRenderer.invoke('companion:pair', input), disconnect: (deviceId) => ipcRenderer.invoke('companion:disconnect', deviceId), revoke: (deviceId) => ipcRenderer.invoke('companion:revoke', deviceId), grantPermission: (deviceId, permission) => ipcRenderer.invoke('companion:permission-grant', deviceId, permission) }
};

contextBridge.exposeInMainWorld('tesh', bridge);
