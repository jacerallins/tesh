export type TeshVisualState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'processing'
  | 'permission'
  | 'success'
  | 'error'
  | 'offline';

export const visualStates: readonly TeshVisualState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'processing',
  'permission',
  'success',
  'error',
  'offline'
];

export const stateLabels: Record<TeshVisualState, string> = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  processing: 'Processing',
  permission: 'Permission',
  success: 'Success',
  error: 'Error',
  offline: 'Offline'
};

export const stateDescriptions: Record<TeshVisualState, string> = {
  idle: 'Present and ready',
  listening: 'Visual listening simulation',
  thinking: 'Visual processing simulation',
  speaking: 'Audio-reactive visual placeholder',
  processing: 'Visual tool-operation simulation',
  permission: 'Permission state simulation',
  success: 'Visual confirmation simulation',
  error: 'Calm visual error state',
  offline: 'Offline visual state simulation'
};
