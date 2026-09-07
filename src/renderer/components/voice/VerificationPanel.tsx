import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { TeshVisualStateController } from '../../hooks/useTeshVisualState';

interface VerificationPanelProps { activation: TeshVisualStateController['activation']; snapshot: TeshVisualStateController['activationSnapshot']; }

export function VerificationPanel({ activation, snapshot }: VerificationPanelProps): ReactElement {
  const [message, setMessage] = useState('');
  const [enrollment, setEnrollment] = useState(snapshot.enrollment);
  useEffect(() => { setEnrollment(snapshot.enrollment); }, [snapshot.enrollment]);
  const enroll = async (): Promise<void> => { await activation.enrollTestIdentity(); setMessage('MOCK ENROLLMENT: three development samples enrolled.'); };
  const clear = async (): Promise<void> => { await activation.clearEnrollment(); setMessage('Development enrollment cleared.'); };
  const simulate = async (result: 'VERIFIED' | 'NOT_VERIFIED' | 'VERIFICATION_UNAVAILABLE', liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE' = 'UNAVAILABLE'): Promise<void> => { activation.setMockResult(result, liveness); await activation.simulateWakePhrase(); setMessage(result === 'VERIFIED' ? 'MOCK VERIFICATION: PASS. Real speaker verification is not active.' : ''); };
  return <section className="verification-panel" aria-label="Development wake phrase and speaker verification controls">
    <div className="memory-heading"><div><p className="panel-label">Development only</p><h2>Wake phrase and speaker verification</h2></div><span>MOCK PROVIDERS</span></div>
    <div className="verification-meta"><div><span className="panel-label">Wake phrase</span><strong>{activation.wakePhrase}</strong></div><div><span className="panel-label">Enrollment</span><strong>{enrollment}</strong></div><div><span className="panel-label">Phase</span><strong>{snapshot.phase}</strong></div><div><span className="panel-label">Attempts left</span><strong>{snapshot.attemptsRemaining}</strong></div></div>
    <div className="voice-actions"><button type="button" onClick={() => void enroll()}>Enroll test identity</button><button type="button" onClick={() => void activation.simulateWakePhrase()}>Simulate wake phrase</button><button type="button" onClick={() => void simulate('VERIFIED', 'PASS')}>Simulate MOCK PASS</button><button type="button" onClick={() => void simulate('NOT_VERIFIED')}>Simulate MOCK FAIL</button><button type="button" onClick={() => void simulate('VERIFIED', 'FAIL')}>Simulate liveness fail</button><button type="button" onClick={() => void clear()}>Clear enrollment</button></div>
    <p className="preview-copy">Provider: Development mock. No voice biometric data is stored, logged, exposed to the renderer, or sent over the network. Liveness is unavailable except when explicitly simulated.</p>
    {snapshot.session ? <div className="session-readout"><span className="panel-label">Verified session</span><strong>{snapshot.session.verificationMethod} · expires {new Date(snapshot.session.expiresAt).toLocaleTimeString()}</strong></div> : null}
    <p className="memory-message" aria-live="polite">{message}</p>
  </section>;
}