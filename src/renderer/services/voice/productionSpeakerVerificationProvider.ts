import { VoiceError, type EnrollmentStatus, type PrimaryUserIdentity, type SpeakerVerificationProvider, type VerificationAttempt } from '../../../shared/voice';

/**
 * Safe production boundary until a real biometric implementation is installed.
 * It intentionally never claims that a speaker was verified.
 */
export class ProductionSpeakerVerificationProvider implements SpeakerVerificationProvider {
  readonly name = 'Production speaker verification unavailable';
  readonly isMock = false;

  async enroll(_samples: readonly unknown[]): Promise<PrimaryUserIdentity> {
    throw new VoiceError('VERIFICATION_UNAVAILABLE' as never, 'Production speaker verification is not configured.');
  }

  async verify(): Promise<VerificationAttempt> {
    return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: this.name };
  }

  async removeEnrollment(): Promise<void> {}

  async getStatus(): Promise<PrimaryUserIdentity | undefined> { return undefined; }

  getEnrollmentStatus(): EnrollmentStatus { return 'NOT_ENROLLED'; }
}
