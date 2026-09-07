import { useRef } from 'react';
import type { ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TeshVisualState } from '../../state/teshVisualState';
import { getVisualProfile, visualTokens } from './visualTokens';

interface TeshEnergyFieldProps {
  state: TeshVisualState;
  audioAmplitude: number;
}

export function TeshEnergyField({ state, audioAmplitude }: TeshEnergyFieldProps): ReactElement {
  const fieldRef = useRef<THREE.Mesh>(null);
  const profile = getVisualProfile(state);

  useFrame(({ clock }) => {
    if (!fieldRef.current) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.4) * 0.025 + audioAmplitude * 0.08;
    fieldRef.current.scale.setScalar(pulse);
    fieldRef.current.rotation.y += 0.0015 + profile.orbitSpeed * 0.001;
  });

  return (
    <mesh ref={fieldRef}>
      <icosahedronGeometry args={[visualTokens.core.radius * 1.2, 3]} />
      <meshBasicMaterial color={profile.color} transparent opacity={0.055 * profile.energy} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
