export const routineModes = ['MANUAL', 'SCHEDULED', 'EVENT'] as const;
export type RoutineMode = (typeof routineModes)[number];

export const routineActions = ['OPEN_APP', 'CLOSE_APP', 'SET_VOLUME', 'SET_DND', 'RUN_COMMAND', 'SHOW_NOTIFICATION', 'START_CONVERSATION', 'DEVICE_ACTION'] as const;
export type RoutineActionType = (typeof routineActions)[number];

export interface RoutineAction {
  id: string;
  type: RoutineActionType;
  input: Record<string, string | number | boolean>;
  requiresConfirmation: boolean;
}

export interface RoutineTrigger {
  mode: RoutineMode;
  schedule?: string;
  event?: string;
}

export interface Routine {
  id: string;
  name: string;
  enabled: boolean;
  trigger: RoutineTrigger;
  actions: RoutineAction[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

export interface RoutineExecutionResult {
  routineId: string;
  success: boolean;
  completedActionIds: string[];
  failedActionId?: string;
  reason?: string;
  startedAt: string;
  completedAt: string;
}

export interface RoutineBridge {
  list: () => Promise<Routine[]>;
  create: (routine: Omit<Routine, 'createdAt' | 'updatedAt' | 'lastRunAt'>) => Promise<Routine>;
  update: (id: string, patch: Partial<Pick<Routine, 'name' | 'enabled' | 'trigger' | 'actions'>>) => Promise<Routine>;
  delete: (id: string) => Promise<boolean>;
  run: (id: string, confirmed?: boolean) => Promise<RoutineExecutionResult>;
}
