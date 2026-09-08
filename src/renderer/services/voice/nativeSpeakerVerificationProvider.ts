import type { EnrollmentStatus, PrimaryUserIdentity, SpeakerVerificationProvider, VerificationAttempt } from '../../../shared/voice';

export class NativeSpeakerVerificationProvider implements SpeakerVerificationProvider {
  readonly name = 'Sherpa-ONNX speaker embedding';
  readonly isMock = false;
  private identity?: PrimaryUserIdentity;

  async enroll(samples: readonly unknown[]): Promise<PrimaryUserIdentity> {
    const count = Math.max(1, Math.min(10, samples.length || 3));
    if (!window.tesh?.nativeSpeaker) throw new Error('Native speaker verification bridge is unavailable.');
    const status = await window.tesh.nativeSpeaker.enroll(count);
    const now = new Date().toISOString();
    this.identity = { id: 'primary-user', displayName: 'Primary user', enrollmentStatus: status.enrolled ? 'ENROLLED' : 'NOT_ENROLLED', createdAt: this.identity?.createdAt ?? now, updatedAt: now, verificationVersion: 'sherpa-onnx-v1' };
    return { ...this.identity };
  }

  async verify(): Promise<VerificationAttempt> {
    if (!window.tesh?.nativeSpeaker) return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: this.name };
    const result = await window.tesh.nativeSpeaker.verify();
    return { result: result.result, confidence: result.confidence, liveness: result.liveness, method: result.method };
  }

  async removeEnrollment(): Promise<void> {
    if (!window.tesh?.nativeSpeaker) throw new Error('Native speaker verification bridge is unavailable.');
    await window.tesh.nativeSpeaker.clear();
    this.identity = undefined;
  }

  async getStatus(): Promise<PrimaryUserIdentity | undefined> {
    if (!window.tesh?.nativeSpeaker) return this.identity ? { ...this.identity } : undefined;
    const status = await window.tesh.nativeSpeaker.status();
    if (!status.enrolled) { this.identity = undefined; return undefined; }
    const now = new Date().toISOString();
    this.identity ??= { id: 'primary-user', displayName: 'Primary user', enrollmentStatus: 'ENROLLED', createdAt: now, updatedAt: now, verificationVersion: 'sherpa-onnx-v1' };
    return { ...this.identity, enrollmentStatus: 'ENROLLED', updatedAt: now };
  }

  getEnrollmentStatus(): EnrollmentStatus { return this.identity?.enrollmentStatus ?? 'NOT_ENROLLED'; }
}
