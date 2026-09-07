import type { EnrollmentStatus, PrimaryUserIdentity, SpeakerVerificationProvider, VerificationAttempt } from '../../../shared/voice';

export class DevelopmentSpeakerVerificationProvider implements SpeakerVerificationProvider {
  readonly name = 'Development mock';
  readonly isMock = true;
  private identity?: PrimaryUserIdentity;
  private nextAttempt: VerificationAttempt = { result: 'NOT_VERIFIED', liveness: 'UNAVAILABLE', method: this.name };
  private sampleCount = 0;

  async enroll(samples: readonly unknown[]): Promise<PrimaryUserIdentity> {
    this.sampleCount += samples.length;
    const now = new Date().toISOString();
    this.identity = { id: 'development-primary-user', displayName: 'Development user', enrollmentStatus: 'ENROLLED', createdAt: now, updatedAt: now, verificationVersion: 'mock-v1' };
    return { ...this.identity };
  }
  async verify(): Promise<VerificationAttempt> { return { ...this.nextAttempt }; }
  async removeEnrollment(): Promise<void> { this.identity = undefined; this.sampleCount = 0; }
  async getStatus(): Promise<PrimaryUserIdentity | undefined> { return this.identity ? { ...this.identity } : undefined; }
  setNextAttempt(attempt: VerificationAttempt): void { this.nextAttempt = { ...attempt, method: this.name }; }
  getSamples(): number { return this.sampleCount; }
  getEnrollmentStatus(): EnrollmentStatus { return this.identity?.enrollmentStatus ?? 'NOT_ENROLLED'; }
}