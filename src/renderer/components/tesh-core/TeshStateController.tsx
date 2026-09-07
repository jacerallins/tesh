import type { TeshVisualState } from '../../state/teshVisualState';
import { getVisualProfile } from './visualTokens';

interface TeshStateControllerProps {
  state: TeshVisualState;
  audioAmplitude: number;
}

export function TeshStateController({ state, audioAmplitude }: TeshStateControllerProps): { color: string; intensity: number } {
  const profile = getVisualProfile(state);
  return { color: profile.color, intensity: profile.energy + audioAmplitude * 0.2 };
}
