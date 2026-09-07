import type { EnrollmentStatus, PrimaryUserIdentity, SpeakerVerificationProvider, VerificationAttempt } from '../../../shared/voice';

export class NativeSpeakerVerificationProvider implements SpeakerVerificationProvider {
  readonly name = 'sherpa-onnx speaker embedding';
  readonly isMock = false;
  private enrolled = false;

  async enroll(_samples: readonly unknown[]): Promise<PrimaryUserIdentity> {
    const bridge = window.tesh?.voice;
    if (!bridge) throw new Error('Native speaker verification bridge is unavailable.');
    await bridge.enrollSpeaker(3);
    this.enrolled = true;
    const now = new Date().toISOString();
    return { id: 'primary-user', displayName: 'Primary user', enrollmentStatus: 'ENROLLED', createdAt: now, updatedAt: now, verificationVersion: 'sherpa-onnx-v1' };
  }
  async verify(): Promise<VerificationAttempt> { const bridge = window.tesh?.voice; if (!bridge) return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: this.name }; const attempt = await bridge.verifySpeaker(); return { result: attempt.result, confidence: attempt.confidence, liveness: attempt.liveness, method: attempt.method }; }
  async removeEnrollment(): Promise<void> { await window.tesh?.voice?.clearSpeakerEnrollment(); this.enrolled = false; }
  async getStatus(): Promise<PrimaryUserIdentity | undefined> {
    const configured = await window.tesh?.voice?.isSpeakerConfigured(); const enrolled = await window.tesh?.voice?.isSpeakerEnrolled(); this.enrolled = Boolean(enrolled); if (!configured || !enrolled) return undefined;
    const now = new Date().toISOString(); return { id: 'primary-user', displayName: 'Primary user', enrollmentStatus: 'ENROLLED', createdAt: now, updatedAt: now, verificationVersion: 'sherpa-onnx-v1' };
  }
  getEnrollmentStatus(): EnrollmentStatus { return this.enrolled ? 'ENROLLED' : 'NOT_ENROLLED'; }
}
