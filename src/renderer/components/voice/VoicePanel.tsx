import { useState } from 'react';
import type { ReactElement } from 'react';
import type { TeshVisualStateController } from '../../hooks/useTeshVisualState';

interface VoicePanelProps { voice: TeshVisualStateController['voice']; snapshot: TeshVisualStateController['voiceSnapshot']; }

export function VoicePanel({ voice, snapshot }: VoicePanelProps): ReactElement {
  const [permissionMessage, setPermissionMessage] = useState('');
  const permissionBridge = window.tesh?.permissions;
  const requestPermission = async (): Promise<void> => {
    if (!permissionBridge) { setPermissionMessage('Electron permission controls are unavailable in browser preview.'); return; }
    await permissionBridge.grant('MICROPHONE', undefined, 'SESSION');
    setPermissionMessage('Microphone permission granted for this session.');
  };
  const provider = voice.getSnapshot().microphone === 'active' && window.tesh?.nativeSpeech ? 'Windows native SpeechRecognition' : 'Browser SpeechRecognition / Windows native fallback';
  return <section className="voice-panel" aria-label="Development voice controls">
    <div className="memory-heading"><div><p className="panel-label">Development only</p><h2>Voice and audio pipeline</h2></div><span>{snapshot.microphone.toUpperCase()}</span></div>
    <div className="voice-actions">
      <button type="button" onClick={() => void requestPermission()}>Request microphone permission</button>
      <button type="button" onClick={() => void voice.startListening()} disabled={snapshot.recognition === 'listening'}>Start listening</button>
      <button type="button" onClick={() => void voice.stopListening()} disabled={snapshot.recognition === 'idle' && snapshot.microphone === 'inactive'}>Stop listening</button>
      <button type="button" onClick={() => void voice.speak('Hello Tesh.')}>Test TTS</button>
      <button type="button" onClick={() => void voice.stopSpeaking()}>Stop TTS</button>
      <button type="button" onClick={() => voice.simulateSpeaking()}>Simulate speaking</button>
    </div>
    <div className="voice-readout">
      <div><span className="panel-label">Recognition</span><strong>{snapshot.recognition}</strong></div>
      <div><span className="panel-label">TTS</span><strong>{snapshot.tts}</strong></div>
      <div><span className="panel-label">Amplitude</span><strong>{snapshot.audio.amplitude.toFixed(3)}</strong></div>
      <div><span className="panel-label">Input</span><strong>{snapshot.audio.inputDevice || (window.tesh?.nativeSpeech ? 'Windows default microphone' : 'Not active')}</strong></div>
    </div>
    <div className="transcript"><span className="panel-label">Interim transcript</span><p>{snapshot.interimTranscript || 'No interim speech yet.'}</p><span className="panel-label">Final transcript</span><p>{snapshot.finalTranscript || 'Try saying "Hello Tesh."'}</p></div>
    <p className="preview-copy">Recognition provider: {provider}. {snapshot.error ? snapshot.error.message : window.tesh?.nativeSpeech ? 'Electron uses the local Windows speech bridge; browser speech is retained for browser preview.' : 'Browser speech behavior depends on the configured speech service.'}</p>
    <p className="memory-message" aria-live="polite">{permissionMessage || snapshot.error?.message}</p>
  </section>;
}
