import { execFile } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface NativeSpeakerAttempt {
  result: 'VERIFIED' | 'NOT_VERIFIED' | 'VERIFICATION_UNAVAILABLE';
  confidence?: number;
  liveness: 'PASS' | 'FAIL' | 'UNAVAILABLE';
  method: string;
}

export interface NativeSpeakerVerificationConfig {
  executable?: string;
  script: string;
  model: string;
  profile: string;
}

interface SpeakerJsonResult {
  verified?: boolean;
  confidence?: number;
  liveness?: 'PASS' | 'FAIL' | 'UNAVAILABLE';
}

export class NativeSpeakerVerificationService {
  private readonly executable: string;
  private readonly script: string;
  private readonly model: string;
  private readonly profile: string;

  constructor(config: NativeSpeakerVerificationConfig) {
    this.executable = config.executable ?? process.env.TESH_SPEAKER_PYTHON ?? 'python';
    this.script = config.script;
    this.model = config.model;
    this.profile = config.profile;
  }

  isConfigured(): boolean {
    return Boolean(this.script && this.model && existsSync(this.script) && existsSync(this.model));
  }

  isEnrolled(): boolean {
    return this.isConfigured() && existsSync(this.profile);
  }

  async enroll(samples = 3): Promise<void> {
    this.assertConfigured();
    await execFileAsync(this.executable, [
      this.script,
      'enroll',
      '--model', this.model,
      '--profile', this.profile,
      '--samples', String(Math.max(1, Math.min(10, samples))),
    ], { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
  }

  async enrollFromAudioFiles(audioFiles: readonly string[]): Promise<void> {
    this.assertConfigured();
    if (audioFiles.length < 1 || audioFiles.length > 10) throw new Error('Choose between 1 and 10 voice recordings.');
    await execFileAsync(this.executable, [
      this.script,
      'enroll',
      '--model', this.model,
      '--profile', this.profile,
      ...audioFiles.flatMap((file) => ['--audio', file]),
    ], { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 });
  }

  async clearEnrollment(): Promise<void> {
    if (existsSync(this.profile)) unlinkSync(this.profile);
  }

  async verify(audioFile?: string): Promise<NativeSpeakerAttempt> {
    if (!this.isEnrolled()) return this.unavailable();
    try {
      const args = [this.script, 'verify', '--model', this.model, '--profile', this.profile];
      if (audioFile) args.push('--audio', audioFile);
      const { stdout } = await execFileAsync(this.executable, args, { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '';
      const value = JSON.parse(line) as SpeakerJsonResult;
      return {
        result: value.verified ? 'VERIFIED' : 'NOT_VERIFIED',
        confidence: value.confidence,
        liveness: value.liveness ?? 'UNAVAILABLE',
        method: 'sherpa-onnx speaker embedding',
      };
    } catch {
      return { result: 'NOT_VERIFIED', liveness: 'UNAVAILABLE', method: 'sherpa-onnx speaker embedding' };
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) throw new Error('Native speaker verification is not configured. Set the speaker model and ensure the helper script exists.');
  }

  private unavailable(): NativeSpeakerAttempt {
    return { result: 'VERIFICATION_UNAVAILABLE', liveness: 'UNAVAILABLE', method: 'Native speaker verification unavailable or not enrolled' };
  }
}
