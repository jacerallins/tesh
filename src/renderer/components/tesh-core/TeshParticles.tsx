import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { Points, PointMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TeshVisualState } from '../../state/teshVisualState';
import { getVisualProfile, visualTokens } from './visualTokens';

interface TeshParticlesProps {
  state: TeshVisualState;
  audioAmplitude: number;
}

export function TeshParticles({ state, audioAmplitude }: TeshParticlesProps): React.ReactElement {
  const particlesRef = useRef<THREE.Points>(null);
  const points = useMemo(() => {
    const positions = new Float32Array(visualTokens.particles.count * 3);
    const random = new THREE.Vector3();

    for (let index = 0; index < visualTokens.particles.count; index += 1) {
      random.setFromSphericalCoords(
        1.65 + Math.random() * visualTokens.particles.spread,
        Math.acos(2 * Math.random() - 1),
        Math.random() * Math.PI * 2
      );
      positions.set([random.x, random.y, random.z], index * 3);
    }

    return positions;
  }, []);

  const profile = getVisualProfile(state);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    particlesRef.current.rotation.y = clock.getElapsedTime() * profile.orbitSpeed * 0.08;
    particlesRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.08;
  });

  return (
    <Points ref={particlesRef} positions={points} stride={3} rotation={[0, 0, 0]}>
      <PointMaterial
        transparent
        color={profile.color}
        size={visualTokens.particles.size + audioAmplitude * 0.025}
        sizeAttenuation
        depthWrite={false}
        opacity={profile.particleOpacity}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}
