import { ipcMain } from 'electron';
import type { FailureComponent } from '../shared/diagnosticsTypes';
import type { DiagnosticsService } from './diagnosticsService';

const components: readonly FailureComponent[] = ['AI', 'VOICE', 'TTS', 'MEMORY', 'FILESYSTEM', 'COMMUNICATION', 'PERMISSIONS'];

export function validateFailureInput(component: unknown, value: unknown): { component: FailureComponent; enabled: boolean } {
  if (typeof component !== 'string' || !components.includes(component as FailureComponent) || typeof value !== 'boolean') throw new Error('Failure control is invalid.');
  return { component: component as FailureComponent, enabled: value };
}

export function registerDiagnosticsIpc(service: DiagnosticsService, enabled: boolean): void {
  if (!enabled) return;
  ipcMain.handle('diagnostics:snapshot', () => service.getSnapshot());
  ipcMain.handle('diagnostics:set-failure', (_event, component: unknown, value: unknown) => {
    const input = validateFailureInput(component, value);
    return service.setFailure(input.component, input.enabled);
  });
}