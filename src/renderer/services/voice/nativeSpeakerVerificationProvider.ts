import type { PrimaryUserIdentity, SpeakerVerificationProvider, VerificationAttempt } from '../../../shared/voice';

export class NativeSpeakerVerificationProvider implements SpeakerVerificationProvider {
  readonly name = 'sherpa-onnx speaker embedding';
  readonly isMock = false;

  async enroll(_samples: readonly unknown[]): Promise<PrimaryUserIdentity> {
    return this.enrollFromRecordings();
  }

  async enrollFromRecordings(): Promise<PrimaryUserIdentity> {
    const bridge = window.tesh?.speakerVerification;
    if (!bridge) throw new Error('Native speaker verification is unavailable outside the Electron app.');
    const result = await bridge.enrollFromFiles();
    if (!result.enrolled) throw new Error(result.message ?? 'Voice enrollment was not completed.');
    return this.identity();
  }

  async verify(): Promise<VerificationAttempt> {
    const bridge = window.tesh?.speakerVerification;
    if (!bridge) return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: this.name };
    return bridge.verify();
  }

  async removeEnrollment(): Promise<void> {
    await window.tesh?.speakerVerification?.clearEnrollment();
  }

  async getStatus(): Promise<PrimaryUserIdentity | undefined> {
    const enrolled = await window.tesh?.speakerVerification?.isEnrolled();
    return enrolled ? this.identity() : undefined;
  }

  private identity(): PrimaryUserIdentity {
    const now = new Date().toISOString();
    return {
      id: 'native-primary-user',
      displayName: 'Primary user',
      enrollmentStatus: 'ENROLLED',
      createdAt: now,
      updatedAt: now,
      verificationVersion: 'sherpa-onnx-v2',
    };
  }
}
