import { execFile } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export interface NativeSpeakerAttempt { result: 'VERIFIED' | 'NOT_VERIFIED' | 'VERIFICATION_UNAVAILABLE'; confidence?: number; liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE'; method: string; }
export class NativeSpeakerVerificationService {
  private readonly executable = process.env.TESH_SPEAKER_PYTHON ?? 'python';
  private readonly script = process.env.TESH_SPEAKER_SCRIPT ?? '';
  private readonly model = process.env.TESH_SPEAKER_MODEL ?? '';
  private readonly profile = process.env.TESH_SPEAKER_PROFILE ?? '';
  isConfigured(): boolean { return Boolean(this.script && this.model && this.profile); }
  isEnrolled(): boolean { return this.isConfigured() && existsSync(this.profile); }
  async enroll(samples = 3): Promise<void> { if (!this.isConfigured()) throw new Error('Native speaker verification is not configured.'); await execFileAsync(this.executable, [this.script, 'enroll', '--model', this.model, '--profile', this.profile, '--samples', String(Math.max(1, Math.min(10, samples)))], { windowsHide: true, timeout: 120000 }); }
  async clearEnrollment(): Promise<void> { if (existsSync(this.profile)) unlinkSync(this.profile); }
  async verify(): Promise<NativeSpeakerAttempt> {
    if (!this.isEnrolled()) return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: 'Native speaker verification unavailable or not enrolled' };
    try {
      const { stdout } = await execFileAsync(this.executable, [this.script, 'verify', '--model', this.model, '--profile', this.profile], { windowsHide: true, timeout: 30000 });
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '';
      const value = JSON.parse(line) as { verified?: boolean; confidence?: number };
      return { result: value.verified ? 'VERIFIED' : 'NOT_VERIFIED', confidence: value.confidence, liveness: 'UNAVAILABLE', method: 'sherpa-onnx speaker embedding' };
    } catch { return { result: 'NOT_VERIFIED', liveness: 'UNAVAILABLE', method: 'sherpa-onnx speaker embedding' }; }
  }
}
