import type { TeshInteractionEngine } from '../../engine/teshInteractionEngine';
import type { VoiceController } from './voiceController';
import type { WakeWordService } from './wakeWordService';
import type { SpeakerVerificationProvider, VerificationConfiguration, VerificationResult, VerifiedSession } from '../../../shared/voice';
import { VoiceError } from '../../../shared/voice';

export interface ActivationSnapshot {
  phase: 'IDLE' | 'WAKE_DETECTED' | 'VERIFYING' | 'LISTENING' | 'BACKOFF';
  enrollment: 'NOT_ENROLLED' | 'ENROLLING' | 'ENROLLED';
  lastResult?: VerificationResult;
  session?: VerifiedSession;
  attemptsRemaining: number;
  mock: boolean;
}
type Listener = () => void;

export const defaultVerificationConfiguration: VerificationConfiguration = { wakePhrase: 'Tesh Pineapples', confidenceThreshold: 0.82, failedAttemptLimit: 3, backoffMs: 15000, sessionTimeoutMs: 15 * 60 * 1000, requiredEnrollmentSamples: 3 };

export class VoiceActivationService {
  private snapshot: ActivationSnapshot = { phase: 'IDLE', enrollment: 'NOT_ENROLLED', attemptsRemaining: defaultVerificationConfiguration.failedAttemptLimit, mock: false };
  private readonly listeners = new Set<Listener>();
  private failureCount = 0;
  private backoffUntil = 0;
  private sessionTimer?: ReturnType<typeof setTimeout>;
  private wakeUnsubscribe?: () => void;

  constructor(private readonly engine: TeshInteractionEngine, private readonly voice: VoiceController, private readonly wake: WakeWordService, private readonly speaker: SpeakerVerificationProvider, private readonly config: VerificationConfiguration = defaultVerificationConfiguration) { this.snapshot = { ...this.snapshot, mock: speaker.isMock }; }
  get wakePhrase(): string { return this.wake.phrase; }
  getSnapshot(): ActivationSnapshot { return this.snapshot; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async start(): Promise<void> {
    try {
      await this.wake.start();
      this.wakeUnsubscribe?.();
      this.wakeUnsubscribe = this.wake.onWakeDetected(() => { void this.handleWakeDetected(); });
    } catch (error) {
      if (error instanceof VoiceError && error.code === 'WAKE_WORD_UNAVAILABLE') {
        this.snapshot = { ...this.snapshot, phase: 'IDLE', lastResult: 'VERIFICATION_UNAVAILABLE' };
        this.notify();
        return;
      }
      throw error;
    }
  }
  async stop(): Promise<void> { this.wakeUnsubscribe?.(); this.wakeUnsubscribe = undefined; await this.wake.stop(); await this.voice.stopListening(); this.clearSession(); }
  async handleWakeDetected(): Promise<void> {
    if (this.snapshot.phase === 'VERIFYING' || this.snapshot.phase === 'LISTENING' || Date.now() < this.backoffUntil) return;
    this.snapshot = { ...this.snapshot, phase: 'WAKE_DETECTED' }; this.notify();
    const identity = await this.speaker.getStatus();
    if (!identity) return this.silentFailure('NO_ENROLLMENT');
    this.snapshot = { ...this.snapshot, phase: 'VERIFYING' }; this.notify();
    const attempt = await this.speaker.verify();
    const verified = attempt.result === 'VERIFIED' && (attempt.confidence === undefined || attempt.confidence >= this.config.confidenceThreshold) && attempt.liveness !== 'FAIL';
    if (!verified) return this.silentFailure(attempt.result === 'VERIFIED' ? 'NOT_VERIFIED' : attempt.result);
    this.failureCount = 0;
    const now = Date.now();
    this.snapshot = { ...this.snapshot, phase: 'LISTENING', lastResult: 'VERIFIED', session: { sessionId: `verified-${now}-${Math.random().toString(36).slice(2, 8)}`, verificationStatus: 'VERIFIED', verifiedAt: new Date(now).toISOString(), expiresAt: new Date(now + this.config.sessionTimeoutMs).toISOString(), verificationMethod: attempt.method } };
    this.sessionTimer = setTimeout(() => this.expireSession(), this.config.sessionTimeoutMs);
    this.engine.activate();
    this.notify();
    await this.voice.startListening();
  }
  async simulateWakePhrase(): Promise<void> { await this.handleWakeDetected(); }
  async enrollTestIdentity(): Promise<void> { this.snapshot = { ...this.snapshot, enrollment: 'ENROLLING' }; this.notify(); const identity = await this.speaker.enroll(Array.from({ length: this.config.requiredEnrollmentSamples }, (_, index) => `development-sample-${index + 1}`)); this.snapshot = { ...this.snapshot, enrollment: identity.enrollmentStatus }; this.notify(); }
  async clearEnrollment(): Promise<void> { await this.speaker.removeEnrollment(); this.clearSession(); this.snapshot = { ...this.snapshot, phase: 'IDLE', enrollment: 'NOT_ENROLLED', lastResult: undefined }; this.notify(); }
  setMockResult(result: VerificationResult, liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE' = 'UNAVAILABLE', confidence = 1): void { const provider = this.speaker as { setNextAttempt?: (attempt: { result: VerificationResult; liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE'; confidence: number; method: string }) => void }; provider.setNextAttempt?.({ result, liveness, confidence, method: this.speaker.name }); }
  private silentFailure(result: VerificationResult): void { this.failureCount += 1; const blocked = this.failureCount >= this.config.failedAttemptLimit; this.backoffUntil = blocked ? Date.now() + this.config.backoffMs : 0; this.snapshot = { ...this.snapshot, phase: blocked ? 'BACKOFF' : 'IDLE', lastResult: result, attemptsRemaining: Math.max(0, this.config.failedAttemptLimit - this.failureCount), session: undefined }; this.engine.reset(); this.notify(); }
  private expireSession(): void { this.clearSession(); this.snapshot = { ...this.snapshot, phase: 'IDLE', lastResult: undefined }; this.engine.reset(); this.notify(); }
  private clearSession(): void { if (this.sessionTimer) clearTimeout(this.sessionTimer); this.sessionTimer = undefined; this.snapshot = { ...this.snapshot, session: undefined, attemptsRemaining: this.config.failedAttemptLimit }; }
  private notify(): void { this.listeners.forEach((listener) => listener()); }
}
