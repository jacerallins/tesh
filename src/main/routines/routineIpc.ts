import { ipcMain } from 'electron';
import type { Routine } from '../../shared/routineTypes';
import type { RoutineService } from './routineService';
function id(value: unknown): string { if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) throw new Error('Routine ID is invalid.'); return value; }
function input(value: unknown): Omit<Routine, 'id' | 'createdAt' | 'updatedAt'> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Routine input is invalid.'); return value as Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>; }
export function registerRoutineIpc(service: RoutineService): void { ipcMain.handle('routine:list', () => service.list()); ipcMain.handle('routine:create', (_event, value: unknown) => service.create(input(value))); ipcMain.handle('routine:update', (_event, routineId: unknown, value: unknown) => service.update(id(routineId), input(value))); ipcMain.handle('routine:remove', (_event, routineId: unknown) => service.remove(id(routineId))); ipcMain.handle('routine:run', (_event, routineId: unknown, confirmed?: unknown) => service.run(id(routineId), confirmed === true)); }
