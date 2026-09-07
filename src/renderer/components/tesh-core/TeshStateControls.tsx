import type { ReactElement } from 'react';
import type { TeshVisualState } from '../../state/teshVisualState';
import { stateLabels, visualStates } from '../../state/teshVisualState';

interface TeshStateControlsProps {
  state: TeshVisualState;
  onChange: (state: TeshVisualState) => void;
  onSimulate: () => void;
}

export function TeshStateControls({ state, onChange, onSimulate }: TeshStateControlsProps): ReactElement {
  return (
    <details className="dev-controls">
      <summary>Development state controls</summary>
      <div className="state-buttons" aria-label="Development-only visual state controls">
        <button className="state-button active" type="button" onClick={onSimulate}>Run interaction</button>
        {visualStates.map((nextState) => (
          <button className={nextState === state ? 'state-button active' : 'state-button'} key={nextState} type="button" onClick={() => onChange(nextState)}>
            {stateLabels[nextState]}
          </button>
        ))}
      </div>
    </details>
  );
}
