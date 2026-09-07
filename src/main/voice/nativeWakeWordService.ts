import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';

interface NativeWakeWordOptions { executable: string; args: string[]; }

export class NativeWakeWordService {
  private process?: ChildProcessWithoutNullStreams;
  private reader?: readline.Interface;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly options: NativeWakeWordOptions = { executable: process.env.TESH_WAKEWORD_PYTHON ?? 'python', args: process.env.TESH_WAKEWORD_SCRIPT ? [process.env.TESH_WAKEWORD_SCRIPT] : [] }) {}

  isConfigured(): boolean { return this.options.args.length > 0; }
  onDetected(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async start(phrase: string): Promise<void> {
    if (this.process) return;
    if (!this.isConfigured()) throw new Error('Native wake-word engine is not configured. Set TESH_WAKEWORD_SCRIPT.');
    const child = spawn(this.options.executable, [...this.options.args, '--phrase', phrase], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.process = child;
    this.reader = readline.createInterface({ input: child.stdout });
    this.reader.on('line', (line) => { if (line.trim() === 'DETECTED') this.listeners.forEach((listener) => listener()); });
    child.on('error', () => this.cleanup());
    child.on('exit', () => this.cleanup());
  }

  async sendAudio(samples: ArrayBuffer, sampleRate: number): Promise<void> {
    const child = this.process;
    if (!child || child.stdin.destroyed) return;
    const header = Buffer.allocUnsafe(8);
    header.writeUInt32LE(sampleRate, 0);
    header.writeUInt32LE(samples.byteLength, 4);
    child.stdin.write(header);
    child.stdin.write(Buffer.from(samples));
  }

  async stop(): Promise<void> {
    const child = this.process;
    this.cleanup();
    if (!child) return;
    child.stdin.end();
    child.kill();
  }

  private cleanup(): void { this.reader?.close(); this.reader = undefined; this.process = undefined; }
}
