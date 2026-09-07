import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { RuntimeStatus } from '../shared/types';
import { TeshApplicationError } from './engine/teshInteractionTypes';
import { TeshCore } from './components/tesh-core/TeshCore';
import { TeshStateControls } from './components/tesh-core/TeshStateControls';
import { useTeshVisualState, type TeshVisualStateController } from './hooks/useTeshVisualState';
import { stateDescriptions, stateLabels } from './state/teshVisualState';
import { MemoryPanel } from './components/memory/MemoryPanel';
import { PermissionPanel } from './components/permissions/PermissionPanel';
import { VoicePanel } from './components/voice/VoicePanel';
import { VerificationPanel } from './components/voice/VerificationPanel';
import { VoiceEnrollmentPanel } from './components/voice/VoiceEnrollmentPanel';
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

function FirstRunSetup({ onFinish, visualState }: { onFinish: () => void; visualState: TeshVisualStateController }): ReactElement {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const next = (): void => setStep((current) => Math.min(current + 1, 7));
  const grantMicrophone = async (): Promise<void> => { try { await window.tesh?.permissions.grant('MICROPHONE', undefined, 'SESSION'); setMessage('Microphone permission recorded for this session.'); } catch { setMessage('Microphone permission could not be recorded.'); } };
  const testSpeech = async (): Promise<void> => { setMessage('Listening… say a sentence now.'); await visualState.voice.startListening(); };
  const stopSpeech = async (): Promise<void> => { await visualState.voice.stopListening(); setMessage('Speech test stopped.'); };
  const verifyVoice = async (): Promise<void> => { try { await visualState.activation.simulateWakePhrase(); const result = visualState.activation.getSnapshot().lastResult; setMessage(result === 'VERIFIED' ? 'Voice verified. Tesh is listening.' : `Voice verification result: ${result ?? 'UNKNOWN'}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Voice verification failed.'); } };
  const testAi = async (): Promise<void> => { if (!window.tesh?.conversation) { setMessage('Electron conversation bridge is unavailable.'); return; } try { const conversation = conversationId ? { conversationId } : await window.tesh.conversation.start(); setConversationId(conversation.conversationId); const result = await window.tesh.conversation.send(conversation.conversationId, 'Say hello in one sentence.'); const response = result.messages.at(-1)?.content; setAiReply(response || 'No assistant response returned.'); setMessage(result.status === 'ERROR' ? (result.lastError || 'AI request failed.') : 'AI test completed.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'AI test failed.'); } };
  const titles = ['WELCOME TO TESH', 'Microphone setup', 'Speech recognition test', 'Wake-word setup', 'Set up my voice', 'AI provider setup', 'Optional filesystem', 'Capability summary'];
  const wakePhrase = visualState.activation.wakePhrase;
  const wakeDescription = visualState.activationSnapshot.mock ? 'Development mode uses a simulator unless native voice is enabled.' : 'Tesh listens locally for this wake word and then verifies your enrolled voice before revealing the interface.';
  const identityDescription = visualState.activationSnapshot.mock ? 'Development speaker verification is a mock test path.' : 'Teach Tesh your voice by repeating a few short phrases. The resulting speaker profile stays local.';
  const aiDescription = 'Tesh supports online AI, a local OpenAI-compatible model server, or automatic online-to-local fallback. Credentials remain in the main process.';
  return <main className="setup-shell"><p className="panel-label">First-run setup · {step + 1} of 8</p><h1>{titles[step]}</h1>{step === 0 && <p>Let's get Tesh ready. Required permissions are requested explicitly and optional capabilities can be skipped.</p>}{step === 1 && <><p>Microphone access is required for listening and voice enrollment. Tesh will not silently enable it.</p><div className="voice-actions"><button type="button" onClick={() => void grantMicrophone()}>Allow microphone permission</button><button type="button" onClick={() => void testSpeech()}>Test microphone + speech</button><button type="button" onClick={() => void stopSpeech()}>Stop speech test</button></div><p>{visualState.voiceSnapshot.finalTranscript || visualState.voiceSnapshot.interimTranscript || message}</p></>}{step === 2 && <><p>Use the speech provider and confirm Tesh can hear you.</p><div className="voice-actions"><button type="button" onClick={() => void testSpeech()}>Start speech test</button><button type="button" onClick={() => void stopSpeech()}>Stop</button></div><div className="transcript"><span className="panel-label">Live transcript</span><p>{visualState.voiceSnapshot.interimTranscript || 'Speak now…'}</p><span className="panel-label">Final</span><p>{visualState.voiceSnapshot.finalTranscript || 'No final transcript yet.'}</p></div></>}{step === 3 && <><p>Wake word: <strong>{wakePhrase}</strong>. {wakeDescription}</p>{visualState.activationSnapshot.mock ? <button type="button" onClick={() => void verifyVoice()}>Test wake phrase</button> : <p className="preview-copy">The native wake-word engine must have a trained <strong>Tesh</strong> model configured before background detection can run.</p>}</>}{step === 4 && <>{visualState.activationSnapshot.mock ? <><p>{identityDescription}</p><div className="voice-actions"><button type="button" onClick={() => void visualState.activation.enrollTestIdentity()}>Enroll development identity</button><button type="button" onClick={() => void verifyVoice()} disabled={visualState.activationSnapshot.enrollment !== 'ENROLLED'}>Verify voice</button></div></> : <VoiceEnrollmentPanel onComplete={() => setMessage('Voice enrollment complete.')} />}</>}<p>{visualState.activationSnapshot.enrollment} · {visualState.activationSnapshot.phase}</p>{step === 5 && <><p>{aiDescription}</p><button type="button" onClick={() => void testAi()}>Test AI connection</button>{aiReply ? <pre className="system-output">{aiReply}</pre> : null}</>}{step === 6 && <><p>Filesystem access is optional and permission-scoped. No broad access is granted by default.</p>{window.tesh?.permissions ? <button type="button" onClick={() => void window.tesh?.permissions.grant('READ', undefined, 'SESSION').then(() => setMessage('Read permission granted for this session.')).catch(() => setMessage('Filesystem permission could not be granted.'))}>Grant development read permission</button> : null}</>}{step === 7 && <p>Tesh is ready. After setup, the assistant can remain in the tray and only reveal its interface following successful voice activation.</p>}<p className="memory-message" aria-live="polite">{message}</p><div className="setup-actions"><button type="button" onClick={step === 7 ? onFinish : next}>{step === 7 ? 'Start using Tesh' : 'Continue'}</button>{step > 0 && step < 7 ? <button type="button" onClick={next}>Skip</button> : null}</div></main>;
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
  const processingTranscript = useRef<string | undefined>(undefined);
  const conversationStartPromise = useRef<Promise<string> | undefined>(undefined);
  const timeoutController = useRef<ConversationTimeoutController | undefined>(undefined);
  if (!timeoutController.current) timeoutController.current = new ConversationTimeoutController(() => { visualState.reset(); window.tesh?.assistant.hide(); conversationId.current = undefined; handledTranscript.current = ''; processingTranscript.current = undefined; conversationStartPromise.current = undefined; });
  useEffect(() => () => timeoutController.current?.dispose(), []);
  useEffect(() => { timeoutController.current?.updateTimeout(conversationTimeout); timeoutController.current?.updateContext({ state: visualState.state, sessionId: visualState.sessionId, stateStartedAt: Date.now(), audio: visualState.audio }); }, [conversationTimeout, visualState.state, visualState.sessionId, visualState.audio]);
  useEffect(() => { if (!window.tesh) return; void window.tesh.getRuntimeStatus().then(setRuntimeStatus); if (import.meta.env.DEV && window.tesh.companion) { const refresh = async (): Promise<void> => setCompanionConnected((await window.tesh?.companion?.getSnapshot())?.connectionState === 'CONNECTED'); void refresh(); const timer = window.setInterval(() => void refresh(), 1000); return () => window.clearInterval(timer); } }, []);
  useEffect(() => {
    if (!setupComplete) return;
    void visualState.activation.start();
    const unsubscribe = window.tesh?.assistant.onActivate(() => { void visualState.activation.handleWakeDetected(); });
    const unsubscribePause = window.tesh?.assistant.onPause((paused) => { if (paused) void visualState.activation.stop(); else void visualState.activation.start(); });
    return () => { unsubscribe?.(); unsubscribePause?.(); void visualState.activation.stop(); };
  }, [visualState.activation, setupComplete]);
  useEffect(() => { window.tesh?.assistant.updateState(visualState.state, visualState.audio.amplitude); }, [visualState.state, visualState.audio.amplitude]);
  useEffect(() => { if (visualState.state === 'listening') window.tesh?.assistant.show(); }, [visualState.state]);
  useEffect(() => {
    const transcript = visualState.voiceSnapshot.finalTranscript.trim(); const conversation = window.tesh?.conversation;
    if (visualState.voiceSnapshot.microphoneTest || !transcript || transcript === handledTranscript.current || processingTranscript.current || !conversation) return;
    handledTranscript.current = transcript; processingTranscript.current = transcript;
    void (async (): Promise<void> => { try { conversationStartPromise.current ??= conversation.start().then(({ conversationId: id }) => id); conversationId.current ??= await conversationStartPromise.current; visualState.beginProcessing('conversation'); const result = await conversation.send(conversationId.current, transcript); if (result.status === 'ERROR') { visualState.error(new TeshApplicationError(result.lastError ?? 'AI_REQUEST_FAILED', 'Conversation failed.')); return; } if (result.status === 'AWAITING_CONFIRMATION') { visualState.requestPermission({ id: result.pendingTool?.id ?? 'tool-confirmation', capability: result.pendingTool?.toolId ?? 'tool', requestedAt: Date.now() }); return; } const response = result.messages.filter((message) => message.role === 'ASSISTANT').at(-1)?.content; if (response) { visualState.beginThinking(); await visualState.voice.speak(response); } } catch (error) { const text = error instanceof Error ? error.message : 'Conversation failed.'; visualState.error(new TeshApplicationError('AI_REQUEST_FAILED', text)); } finally { if (processingTranscript.current === transcript) processingTranscript.current = undefined; } })();
  }, [visualState.voiceSnapshot.finalTranscript, visualState.voice, visualState]);
  if (!setupComplete) return <FirstRunSetup visualState={visualState} onFinish={() => { localStorage.setItem('tesh.setup.completed', 'true'); setSetupComplete(true); }} />;
  return <main className="shell"><header className="topbar"><div className="brand-mark" aria-label="Tesh">T</div><div><p className="eyebrow">Private intelligence</p><h1>Tesh</h1></div><div className="connection-status" aria-label="Connection status"><span className="status-dot" /><span>Local shell</span></div>{import.meta.env.DEV ? <div className="connection-status" aria-label="Companion status"><span className={`status-dot ${companionConnected ? '' : 'status-dot-offline'}`} /><span>Tesh Companion {companionConnected ? 'Connected' : 'Offline'}</span></div> : null}</header><section className="workspace" aria-label="Tesh workspace"><TeshCore state={visualState.state} audioAmplitude={visualState.audio.amplitude} /><div className="state-readout"><span className="state-label">{stateLabels[visualState.state]}</span><p aria-live="polite">{stateDescriptions[visualState.state]}</p></div></section>{import.meta.env.DEV ? <TeshStateControls state={visualState.state} onChange={visualState.simulateState} onSimulate={visualState.simulateInteraction} /> : null}{import.meta.env.DEV ? <MemoryPanel /> : null}{import.meta.env.DEV ? <PermissionPanel /> : null}{import.meta.env.DEV ? <VoicePanel voice={visualState.voice} snapshot={visualState.voiceSnapshot} /> : null}{import.meta.env.DEV ? <VerificationPanel activation={visualState.activation} snapshot={visualState.activationSnapshot} /> : null}{import.meta.env.DEV ? <SystemToolsPanel /> : null}{import.meta.env.DEV ? <ConversationPanel /> : null}{import.meta.env.DEV ? <CommunicationPanel /> : null}{import.meta.env.DEV ? <DiagnosticsPanel /> : null}{import.meta.env.DEV ? <CompanionPanel /> : null}<SettingsPanel voice={visualState.voice} snapshot={visualState.voiceSnapshot} runtimeStatus={runtimeStatus} conversationTimeout={conversationTimeout} onConversationTimeoutChange={setConversationTimeout} /><footer className="status-panel"><div><span className="panel-label">System</span><strong>Visual core online</strong></div><div><span className="panel-label">Runtime</span><strong>{runtimeStatus ? `${runtimeStatus.platform} · Electron` : window.tesh ? 'Connecting...' : 'Browser preview'}</strong></div><p className="scope-note">Capabilities are reported from current permissions and providers. Development mocks are labeled and never presented as production.</p></footer></main>;
}
