import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { TeshVisualStateController } from '../../hooks/useTeshVisualState';

interface VerificationPanelProps { activation: TeshVisualStateController['activation']; snapshot: TeshVisualStateController['activationSnapshot']; }

export function VerificationPanel({ activation, snapshot }: VerificationPanelProps): ReactElement {
  const [message, setMessage] = useState('');
  const [enrollment, setEnrollment] = useState(snapshot.enrollment);
  useEffect(() => { setEnrollment(snapshot.enrollment); }, [snapshot.enrollment]);
  const enroll = async (): Promise<void> => {
    try {
      if (snapshot.mock) {
        await activation.enrollTestIdentity();
        setMessage('MOCK ENROLLMENT: three development samples enrolled.');
      } else {
        await activation.enrollFromRecordings();
        setMessage('Voice enrollment complete. Only the speaker embedding profile is retained.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Voice enrollment failed.');
    }
  };
  const clear = async (): Promise<void> => { await activation.clearEnrollment(); setMessage(snapshot.mock ? 'Development enrollment cleared.' : 'Voice enrollment cleared.'); };
  const simulate = async (result: 'VERIFIED' | 'NOT_VERIFIED' | 'VERIFICATION_UNAVAILABLE', liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE' = 'UNAVAILABLE'): Promise<void> => { activation.setMockResult(result, liveness); await activation.simulateWakePhrase(); setMessage(result === 'VERIFIED' ? 'MOCK VERIFICATION: PASS.' : ''); };
  return <section className="verification-panel" aria-label="Wake phrase and speaker verification controls">
    <div className="memory-heading"><div><p className="panel-label">Voice security</p><h2>Wake phrase and speaker verification</h2></div><span>{snapshot.mock ? 'MOCK PROVIDER' : 'NATIVE PROVIDER'}</span></div>
    <div className="verification-meta"><div><span className="panel-label">Wake phrase</span><strong>{activation.wakePhrase}</strong></div><div><span className="panel-label">Enrollment</span><strong>{enrollment}</strong></div><div><span className="panel-label">Phase</span><strong>{snapshot.phase}</strong></div><div><span className="panel-label">Attempts left</span><strong>{snapshot.attemptsRemaining}</strong></div></div>
    <div className="voice-actions">
      <button type="button" onClick={() => void enroll()}>{snapshot.mock ? 'Enroll test identity' : 'Enroll from recordings'}</button>
      <button type="button" onClick={() => void activation.simulateWakePhrase()}>Simulate wake phrase</button>
      {snapshot.mock ? <><button type="button" onClick={() => void simulate('VERIFIED', 'PASS')}>Simulate MOCK PASS</button><button type="button" onClick={() => void simulate('NOT_VERIFIED')}>Simulate MOCK FAIL</button><button type="button" onClick={() => void simulate('VERIFIED', 'FAIL')}>Simulate liveness fail</button></> : null}
      <button type="button" onClick={() => void clear()}>Clear enrollment</button>
    </div>
    <p className="preview-copy">Provider: {snapshot.mock ? 'Development mock. No biometric verification is active.' : 'sherpa-onnx speaker embedding. Raw enrollment recordings are processed locally and are not stored in the speaker profile.'} Liveness is currently unavailable, so this is speaker similarity rather than replay-resistant authentication.</p>
    {snapshot.session ? <div className="session-readout"><span className="panel-label">Verified session</span><strong>{snapshot.session.verificationMethod} · expires {new Date(snapshot.session.expiresAt).toLocaleTimeString()}</strong></div> : null}
    <p className="memory-message" aria-live="polite">{message}</p>
  </section>;
}
