import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import type { ReactElement } from 'react';
import * as THREE from 'three';
import type { TeshVisualState } from '../../state/teshVisualState';
import { TeshEnergyField } from './TeshEnergyField';
import { TeshParticles } from './TeshParticles';
import { getVisualProfile, visualTokens } from './visualTokens';

interface TeshCoreSceneProps {
  state: TeshVisualState;
  audioAmplitude: number;
}

function TeshCoreScene({ state, audioAmplitude }: TeshCoreSceneProps): ReactElement {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const profile = getVisualProfile(state);

  useFrame(({ clock }) => {
    if (!groupRef.current || !sphereRef.current) return;
    const time = clock.getElapsedTime();
    groupRef.current.rotation.y = time * profile.orbitSpeed * 0.12;
    groupRef.current.rotation.x = Math.sin(time * (state === 'thinking' ? 0.34 : 0.25)) * 0.08;
    const audioResponse = state === 'listening' || state === 'speaking' ? audioAmplitude : 0;
    const breathe = 1 + Math.sin(time * (state === 'thinking' ? 0.72 : 1.15)) * 0.018 + audioResponse * (state === 'speaking' ? 0.13 : 0.09);
    sphereRef.current.scale.setScalar(breathe);
  });

  return (
    <group ref={groupRef}>
      <Float speed={0.6 + profile.orbitSpeed} rotationIntensity={0.12} floatIntensity={0.18}>
        <TeshEnergyField state={state} audioAmplitude={state === 'listening' || state === 'speaking' ? audioAmplitude : 0} />
        <mesh ref={sphereRef}>
          <icosahedronGeometry args={[visualTokens.core.radius, 4]} />
          <meshStandardMaterial color="#100b39" emissive={profile.color} emissiveIntensity={profile.energy * 0.5} roughness={0.24} metalness={0.78} transparent opacity={0.86} />
        </mesh>
        <mesh rotation={[0.2, 0.5, 0]} scale={1.035}>
          <icosahedronGeometry args={[visualTokens.core.radius, 2]} />
          <meshBasicMaterial color={profile.color} wireframe transparent opacity={0.34 * profile.energy} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[Math.PI / 2.5, 0.3, 0]} scale={1.34}>
          <torusGeometry args={[0.82, 0.014, 8, 96]} />
          <meshBasicMaterial color="#ff62c8" transparent opacity={0.78 * profile.energy} blending={THREE.AdditiveBlending} />
        </mesh>
        <TeshParticles state={state} audioAmplitude={state === 'listening' || state === 'speaking' ? audioAmplitude : 0} />
      </Float>
    </group>
  );
}

export function TeshCore({ state, audioAmplitude = 0 }: TeshCoreSceneProps): ReactElement {
  return (
    <div className="core-canvas" aria-hidden="true">
      <Canvas camera={visualTokens.camera} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.12} />
        <pointLight color="#8e6bff" intensity={2.6} distance={5} />
        <pointLight color="#ff62c8" position={[1.8, 0.5, 2]} intensity={1.4} distance={4} />
        <TeshCoreScene state={state} audioAmplitude={audioAmplitude} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
      </Canvas>
    </div>
  );
}
