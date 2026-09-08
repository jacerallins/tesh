import { execFile } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface NativeSpeakerAttempt { result: 'VERIFIED' | 'NOT_VERIFIED' | 'VERIFICATION_UNAVAILABLE'; confidence?: number; liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE'; method: string; }
export interface NativeSpeakerVerificationOptions { executable: string; script: string; model: string; profile: string; }

export class NativeSpeakerVerificationService {
  constructor(private readonly options: NativeSpeakerVerificationOptions) {}
  get profilePath(): string { return this.options.profile; }
  isConfigured(): boolean { return Boolean(this.options.script && this.options.model && existsSync(this.options.script) && existsSync(this.options.model) && this.options.profile); }
  isEnrolled(): boolean { return this.isConfigured() && existsSync(this.options.profile); }

  async enroll(samples = 3): Promise<void> {
    if (!this.isConfigured()) throw new Error('Native speaker verification is not configured. Install the speaker model and ensure the Tesh speaker script is available.');
    await execFileAsync(this.options.executable, [this.options.script, 'enroll', '--model', this.options.model, '--profile', this.options.profile, '--samples', String(Math.max(1, Math.min(10, samples)))], { windowsHide: true, timeout: 120000 });
  }

  async clearEnrollment(): Promise<void> { if (existsSync(this.options.profile)) unlinkSync(this.options.profile); }

  async verify(): Promise<NativeSpeakerAttempt> {
    if (!this.isEnrolled()) return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: 'Native speaker verification unavailable or not enrolled' };
    try {
      const { stdout } = await execFileAsync(this.options.executable, [this.options.script, 'verify', '--model', this.options.model, '--profile', this.options.profile], { windowsHide: true, timeout: 30000 });
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '';
      const value = JSON.parse(line) as { verified?: boolean; confidence?: number };
      return { result: value.verified ? 'VERIFIED' : 'NOT_VERIFIED', confidence: value.confidence, liveness: 'UNAVAILABLE', method: 'sherpa-onnx speaker embedding' };
    } catch { return { result: 'NOT_VERIFIED', liveness: 'UNAVAILABLE', method: 'sherpa-onnx speaker embedding' }; }
  }
}
