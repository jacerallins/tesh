import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface NativeWakeWordStatus {
  available: boolean;
  configured: boolean;
  running: boolean;
  phrase: string;
  modelPath?: string;
  error?: string;
}

export class NativeWakeWordService {
  private process?: ChildProcessWithoutNullStreams;
  private detectedListeners = new Set<() => void>();
  private errorListeners = new Set<(message: string) => void>();

  constructor(private readonly options: { python?: string; script: string; model?: string; phrase?: string }) {}

  getStatus(): NativeWakeWordStatus {
    const phrase = this.options.phrase ?? 'Tesh';
    const model = this.options.model?.trim();
    const configured = Boolean(model && existsSync(model));
    return {
      available: process.platform === 'win32',
      configured,
      running: Boolean(this.process),
      phrase,
      modelPath: model,
      ...(!configured ? { error: model ? 'Tesh wake-word model was not found at the configured path.' : 'No Tesh wake-word model is configured.' } : {}),
    };
  }

  onDetected(listener: () => void): () => void { this.detectedListeners.add(listener); return () => this.detectedListeners.delete(listener); }
  onError(listener: (message: string) => void): () => void { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }

  async start(): Promise<void> {
    if (this.process) return;
    if (process.platform !== 'win32') throw new Error('Native Tesh wake-word detection is currently supported on Windows only.');
    const model = this.options.model?.trim();
    if (!model || !existsSync(model)) throw new Error('No Tesh wake-word model is installed. Set TESH_WAKEWORD_MODEL or place tesh-wakeword.onnx in the Tesh models directory.');
    const child = spawn(this.options.python ?? 'python', [this.options.script, '--phrase', this.options.phrase ?? 'Tesh', '--model', model], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: path.dirname(this.options.script) });
    this.process = child;
    let buffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim() === 'DETECTED') this.detectedListeners.forEach((listener) => listener());
    });
    child.stderr.on('data', (chunk: Buffer) => { const message = chunk.toString('utf8').trim(); if (message) this.errorListeners.forEach((listener) => listener(message)); });
    child.once('error', (error) => { if (this.process === child) this.process = undefined; this.errorListeners.forEach((listener) => listener(error.message)); });
    child.once('exit', (code) => { if (this.process === child) this.process = undefined; if (code !== 0 && code !== null) this.errorListeners.forEach((listener) => listener(`Wake-word helper exited with code ${code}.`)); });
  }

  async stop(): Promise<void> { const child = this.process; if (!child) return; this.process = undefined; try { child.kill(); } catch {} }
  dispose(): void { void this.stop(); this.detectedListeners.clear(); this.errorListeners.clear(); }
}
