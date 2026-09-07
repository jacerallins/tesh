export type EnrollmentStatus = 'NOT_ENROLLED' | 'ENROLLING' | 'ENROLLED';
export type VerificationResult = 'VERIFIED' | 'NOT_VERIFIED' | 'NO_ENROLLMENT' | 'VERIFICATION_UNAVAILABLE' | 'VERIFICATION_ERROR';
export type LivenessResult = 'PASS' | 'FAIL' | 'UNAVAILABLE';

export interface PrimaryUserIdentity {
  id: string;
  displayName: string;
  enrollmentStatus: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
  verificationVersion: string;
}

export interface VerificationConfiguration {
  wakePhrase: string;
  confidenceThreshold: number;
  failedAttemptLimit: number;
  backoffMs: number;
  sessionTimeoutMs: number;
  requiredEnrollmentSamples: number;
}

export interface VerificationAttempt {
  result: VerificationResult;
  confidence?: number;
  liveness: LivenessResult;
  method: string;
}

export interface VerifiedSession {
  sessionId: string;
  verificationStatus: 'VERIFIED';
  verifiedAt: string;
  expiresAt: string;
  verificationMethod: string;
}

export interface SpeakerVerificationProvider {
  readonly name: string;
  readonly isMock: boolean;
  enroll(samples: readonly unknown[]): Promise<PrimaryUserIdentity>;
  verify(): Promise<VerificationAttempt>;
  removeEnrollment(): Promise<void>;
  getStatus(): Promise<PrimaryUserIdentity | undefined>;
}

export interface LivenessProvider {
  check(): Promise<LivenessResult>;
}