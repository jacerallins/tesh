import type { TeshVisualState } from '../../state/teshVisualState';

export const visualTokens = {
  camera: { position: [0, 0, 6] as const, fov: 42 },
  core: { radius: 1.05, segments: 32, maxScale: 1.12 },
  particles: { count: 150, spread: 4.3, size: 0.016 },
  animation: { idleSpeed: 0.18, transition: 3.5, orbit: 0.22 },
  colors: {
    idle: '#6d55d9',
    listening: '#6ed9ff',
    thinking: '#956eff',
    speaking: '#f3fbff',
    processing: '#79b8ff',
    permission: '#f5cb82',
    success: '#9af2b1',
    error: '#f49b9b',
    offline: '#8a9aa7',
    background: '#071117'
  }
} as const;

export interface VisualProfile {
  color: string;
  energy: number;
  orbitSpeed: number;
  particleOpacity: number;
}

export function getVisualProfile(state: TeshVisualState): VisualProfile {
  const profiles: Record<TeshVisualState, VisualProfile> = {
    idle: { color: visualTokens.colors.idle, energy: 0.62, orbitSpeed: 0.3, particleOpacity: 0.36 },
    listening: { color: visualTokens.colors.listening, energy: 0.86, orbitSpeed: 0.52, particleOpacity: 0.58 },
    thinking: { color: visualTokens.colors.thinking, energy: 0.92, orbitSpeed: 0.82, particleOpacity: 0.68 },
    speaking: { color: visualTokens.colors.speaking, energy: 1, orbitSpeed: 0.58, particleOpacity: 0.78 },
    processing: { color: visualTokens.colors.processing, energy: 0.84, orbitSpeed: 0.68, particleOpacity: 0.62 },
    permission: { color: visualTokens.colors.permission, energy: 0.72, orbitSpeed: 0.4, particleOpacity: 0.5 },
    success: { color: visualTokens.colors.success, energy: 0.95, orbitSpeed: 0.5, particleOpacity: 0.65 },
    error: { color: visualTokens.colors.error, energy: 0.7, orbitSpeed: 0.18, particleOpacity: 0.46 },
    offline: { color: visualTokens.colors.offline, energy: 0.42, orbitSpeed: 0.12, particleOpacity: 0.2 }
  };

  return profiles[state];
}
