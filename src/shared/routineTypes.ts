export const routineTriggerTypes = ['MANUAL', 'SCHEDULE', 'EVENT'] as const;
export type RoutineTriggerType = (typeof routineTriggerTypes)[number];
export const routineActionTypes = ['DESKTOP_COMMAND', 'NOTIFICATION', 'DEVICE_ACTION', 'MEMORY_ACTION'] as const;
export type RoutineActionType = (typeof routineActionTypes)[number];
export interface RoutineAction { id: string; type: RoutineActionType; input: Record<string, string>; requiresConfirmation: boolean; }
export interface Routine { id: string; name: string; enabled: boolean; trigger: { type: RoutineTriggerType; value: string }; actions: RoutineAction[]; createdAt: string; updatedAt: string; }
export interface RoutineBridge { list: () => Promise<Routine[]>; create: (input: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Routine>; update: (id: string, input: Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<Routine>; remove: (id: string) => Promise<boolean>; run: (id: string, confirmed?: boolean) => Promise<{ ok: boolean; message: string }>; }
