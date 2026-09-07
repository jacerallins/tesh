import { useState } from 'react';
import type { ReactElement } from 'react';

const PHRASES = [
  'Hey Tesh, I am ready to get started.',
  'Tesh, open my assistant.',
  'I use Tesh to help me every day.',
  'Please remember that my voice is private.',
  'Tesh, are you listening to me?'
] as const;

interface VoiceEnrollmentPanelProps {
  onComplete?: () => void;
  compact?: boolean;
}

export function VoiceEnrollmentPanel({ onComplete, compact = false }: VoiceEnrollmentPanelProps): ReactElement {
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  const native = window.tesh?.voice;
  const phrase = PHRASES[index];

  const record = async (): Promise<void> => {
    if (!native || recording || complete) return;
    setRecording(true);
    setMessage('Listening… speak the phrase naturally.');
    try {
      await native.enrollSpeaker(phrase, 1);
      if (index === PHRASES.length - 1) {
        setComplete(true);
        setMessage('Voice profile created. Tesh can now verify your voice locally.');
        onComplete?.();
      } else {
        setIndex((current) => current + 1);
        setMessage('Good. Next phrase ready.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Voice enrollment failed.');
    } finally {
      setRecording(false);
    }
  };

  const restart = async (): Promise<void> => {
    try { await native?.clearSpeakerEnrollment(); } catch { /* best effort */ }
    setIndex(0);
    setComplete(false);
    setMessage('Voice enrollment reset.');
  };

  if (!native) return <section className="verification-panel" aria-label="Voice enrollment"><p className="preview-copy">Native voice controls are unavailable in this browser preview.</p></section>;

  return <section className={compact ? 'verification-panel compact' : 'verification-panel'} aria-label="Voice enrollment">
    <div className="memory-heading"><div><p className="panel-label">VOICE ID</p><h2>Teach Tesh your voice</h2></div><span>{complete ? 'ENROLLED' : `${index + 1} / ${PHRASES.length}`}</span></div>
    {!complete ? <>
      <p className="settings-lead">Just like setting up Siri, Tesh will ask you to repeat a few different phrases. Speak normally and keep your microphone at your usual distance.</p>
      <article className="capability-status"><span className="panel-label">READ THIS ALOUD</span><strong>{phrase}</strong><p>Sample {index + 1} of {PHRASES.length}</p></article>
      <div className="voice-actions"><button type="button" onClick={() => void record()} disabled={recording}>{recording ? 'Listening…' : 'Record phrase'}</button><button type="button" onClick={() => void restart()} disabled={recording}>Start over</button></div>
    </> : <><article className="capability-status"><strong>Your voice is enrolled</strong><span>LOCAL PROFILE</span><p>Tesh will use the enrolled speaker profile when deciding whether the wake word came from you.</p></article><button type="button" onClick={() => void restart()}>Re-enroll my voice</button></>}
    <p className="memory-message" aria-live="polite">{message}</p>
  </section>;
}
