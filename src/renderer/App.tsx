import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { RuntimeStatus } from '../shared/types';
import { TeshApplicationError } from './engine/teshInteractionTypes';
import { TeshCore } from './components/tesh-core/TeshCore';
import { TeshStateControls } from './components/tesh-core/TeshStateControls';
import { useTeshVisualState } from './hooks/useTeshVisualState';
import { stateDescriptions, stateLabels } from './state/teshVisualState';
import { MemoryPanel } from './components/memory/MemoryPanel';
import { PermissionPanel } from './components/permissions/PermissionPanel';
import { VoicePanel } from './components/voice/VoicePanel';
import { VerificationPanel } from './components/voice/VerificationPanel';
import { SystemToolsPanel } from './components/system/SystemToolsPanel';
import { ConversationPanel } from './components/ai/ConversationPanel';
import { CommunicationPanel } from './components/communication/CommunicationPanel';
import { DiagnosticsPanel } from './components/diagnostics/DiagnosticsPanel';
import { CompanionPanel } from './components/companion/CompanionPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { ConversationTimeoutController, readConversationTimeout } from './services/conversationTimeout';

function AssistantOverlay(): ReactElement {
  const [snapshot, setSnapshot] = useState({ state: 'idle', amplitude: 0 });
  useEffect(() => window.tesh?.assistant.onState(setSnapshot), []);
  return <main className={`assistant-overlay state-${snapshot.state}`} aria-live="polite"><TeshCore state={snapshot.state as Parameters<typeof TeshCore>[0]['state']} audioAmplitude={snapshot.amplitude} /></main>;
}

function FirstRunSetup({ onFinish }: { onFinish: () => void }): ReactElement {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const next = (): void => setStep((current) => Math.min(current + 1, 7));
  const grantMicrophone = async (): Promise<void> => { try { await window.tesh?.permissions.grant('MICROPHONE', undefined, 'SESSION'); setMessage('Microphone permission recorded. Browser access will still be requested when listening starts.'); } catch { setMessage('Microphone permission could not be recorded.'); } };
  const titles = ['WELCOME TO TESH', 'Microphone setup', 'Speech recognition test', 'Wake-word setup', 'Set up my voice', 'AI provider setup', 'Optional filesystem', 'Capability summary'];
  return <main className="setup-shell"><p className="panel-label">First-run setup · {step + 1} of 8</p><h1>{titles[step]}</h1>{step === 0 && <p>Let's get Tesh ready. Required permissions are requested explicitly and optional capabilities can be skipped.</p>}{step === 1 && <><p>Microphone access is required for listening. Tesh will not silently enable it.</p><button type="button" onClick={() => void grantMicrophone()}>Allow microphone permission</button><p>{message}</p></>}{step === 2 && <p>Speech recognition uses the browser provider. Test it later from Voice &amp; Wake; availability depends on Windows and the browser engine.</p>}{step === 3 && <p>Wake phrase: <strong>Tesh Pineapples</strong>. The current provider is development-only and is clearly labeled.</p>}{step === 4 && <p>Speaker verification is <strong>Development speaker verification</strong>. Real biometric verification is unavailable, so no production enrollment is claimed.</p>}{step === 5 && <p>AI is configured only when a provider credential exists in the main process. No API key is shown here.</p>}{step === 6 && <p>Filesystem access is optional and permission-scoped. No broad access is granted by default.</p>}{step === 7 && <p>Tesh is ready to return to its background assistant mode. Review detailed capability status in Settings.</p>}<div className="setup-actions"><button type="button" onClick={step === 7 ? onFinish : next}>{step === 7 ? 'Start using Tesh' : 'Continue'}</button>{step > 0 && step < 7 ? <button type="button" onClick={next}>Skip</button> : null}</div></main>;
}

export function App(): ReactElement {
  if (new URLSearchParams(window.location.search).has('overlay')) return <AssistantOverlay />;
  const [setupComplete, setSetupComplete] = useState(() => localStorage.getItem('tesh.setup.completed') === 'true');
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>();
  const [companionConnected, setCompanionConnected] = useState(false);
  const visualState = useTeshVisualState();
  const [conversationTimeout, setConversationTimeout] = useState(readConversationTimeout);
  const conversationId = useRef<string | undefined>(undefined);
  const handledTranscript = useRef('');
  const timeoutController = useRef<ConversationTimeoutController | undefined>(undefined);

  if (!timeoutController.current) timeoutController.current = new ConversationTimeoutController(() => { visualState.reset(); window.tesh?.assistant.hide(); });
  useEffect(() => () => timeoutController.current?.dispose(), []);
  useEffect(() => {
    timeoutController.current?.updateTimeout(conversationTimeout);
    timeoutController.current?.updateContext({ state: visualState.state, sessionId: visualState.sessionId, stateStartedAt: Date.now(), audio: visualState.audio });
  }, [conversationTimeout, visualState.state, visualState.sessionId, visualState.audio]);

  useEffect(() => {
    if (window.tesh) {
      void window.tesh.getRuntimeStatus().then(setRuntimeStatus);
      if (import.meta.env.DEV && window.tesh.companion) {
        const refresh = async (): Promise<void> => setCompanionConnected((await window.tesh?.companion?.getSnapshot())?.connectionState === 'CONNECTED');
        void refresh();
        const timer = window.setInterval(() => void refresh(), 1000);
        return () => window.clearInterval(timer);
      }
    }
  }, []);

  useEffect(() => {
    void visualState.activation.start();
    const unsubscribe = window.tesh?.assistant.onActivate(() => { void visualState.activation.handleWakeDetected(); });
    const unsubscribePause = window.tesh?.assistant.onPause((paused) => { if (paused) void visualState.activation.stop(); else void visualState.activation.start(); });
    return () => { unsubscribe?.(); unsubscribePause?.(); void visualState.activation.stop(); };
  }, [visualState.activation]);

  useEffect(() => { window.tesh?.assistant.updateState(visualState.state, visualState.audio.amplitude); }, [visualState.state, visualState.audio.amplitude]);
  useEffect(() => { if (visualState.state === 'listening') window.tesh?.assistant.show(); }, [visualState.state]);

  useEffect(() => {
    const transcript = visualState.voiceSnapshot.finalTranscript;
    const conversation = window.tesh?.conversation;
    if (visualState.voiceSnapshot.microphoneTest || !transcript || transcript === handledTranscript.current || !conversation) return;
    handledTranscript.current = transcript;
    void (async () => {
      conversationId.current ??= (await conversation.start()).conversationId;
      visualState.beginProcessing('conversation');
      const result = await conversation.send(conversationId.current, transcript);
      if (result.status === 'ERROR') {
        visualState.error(new TeshApplicationError(result.lastError ?? 'AI_REQUEST_FAILED', 'Conversation failed.'));
        return;
      }
      if (result.status === 'AWAITING_CONFIRMATION') {
        visualState.requestPermission({ id: result.pendingTool?.id ?? 'tool-confirmation', capability: result.pendingTool?.toolId ?? 'tool', requestedAt: Date.now() });
        return;
      }
      const response = result.messages.filter((message) => message.role === 'ASSISTANT').at(-1)?.content;
      if (response) {
        visualState.beginThinking();
        await visualState.voice.speak(response);
      }
    })();
  }, [visualState.voiceSnapshot.finalTranscript, visualState.voice, visualState.beginProcessing, visualState.error, visualState.requestPermission, visualState.beginThinking]);

  if (!setupComplete) return <FirstRunSetup onFinish={() => { localStorage.setItem('tesh.setup.completed', 'true'); setSetupComplete(true); }} />;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="Tesh">T</div>
        <div>
          <p className="eyebrow">Private intelligence</p>
          <h1>Tesh</h1>
        </div>
        <div className="connection-status" aria-label="Connection status">
          <span className="status-dot" />
          <span>Local shell</span>
        </div>
        {import.meta.env.DEV ? <div className="connection-status" aria-label="Companion status"><span className={`status-dot ${companionConnected ? '' : 'status-dot-offline'}`} /><span>Tesh Companion {companionConnected ? 'Connected' : 'Offline'}</span></div> : null}
      </header>

      <section className="workspace" aria-label="Tesh workspace">
        <TeshCore state={visualState.state} audioAmplitude={visualState.audio.amplitude} />
        <div className="state-readout">
          <span className="state-label">{stateLabels[visualState.state]}</span>
          <p aria-live="polite">{stateDescriptions[visualState.state]}</p>
        </div>
      </section>

      {import.meta.env.DEV ? <TeshStateControls state={visualState.state} onChange={visualState.simulateState} onSimulate={visualState.simulateInteraction} /> : null}
      {import.meta.env.DEV ? <MemoryPanel /> : null}
      {import.meta.env.DEV ? <PermissionPanel /> : null}
      {import.meta.env.DEV ? <VoicePanel voice={visualState.voice} snapshot={visualState.voiceSnapshot} /> : null}
      {import.meta.env.DEV ? <VerificationPanel activation={visualState.activation} snapshot={visualState.activationSnapshot} /> : null}
      {import.meta.env.DEV ? <SystemToolsPanel /> : null}
      {import.meta.env.DEV ? <ConversationPanel /> : null}
      {import.meta.env.DEV ? <CommunicationPanel /> : null}
      {import.meta.env.DEV ? <DiagnosticsPanel /> : null}
      {import.meta.env.DEV ? <CompanionPanel /> : null}
      <SettingsPanel voice={visualState.voice} snapshot={visualState.voiceSnapshot} runtimeStatus={runtimeStatus} conversationTimeout={conversationTimeout} onConversationTimeoutChange={setConversationTimeout} />

      <footer className="status-panel">
        <div>
          <span className="panel-label">System</span>
          <strong>Visual core online</strong>
        </div>
        <div>
          <span className="panel-label">Runtime</span>
          <strong>{runtimeStatus ? `${runtimeStatus.platform} · Electron` : window.tesh ? 'Connecting...' : 'Browser preview'}</strong>
        </div>
        <p className="scope-note">Capabilities are reported from current permissions and providers. Development mocks are labeled and never presented as production.</p>
      </footer>
    </main>
  );
}
