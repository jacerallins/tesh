import type { PermissionBridge } from '../../../shared/permissionTypes';
import { VoiceError, type AudioState, type MicrophoneStatus, type PermissionBridgeProvider } from '../../../shared/voice';

type Listener = () => void;

export class MicrophoneService {
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private amplitudeTimer?: ReturnType<typeof setInterval>;
  private readonly listeners = new Set<Listener>();
  private state: MicrophoneStatus = 'inactive';
  private audio: AudioState = { amplitude: 0, active: false };

  constructor(private readonly getPermissions: PermissionBridgeProvider) {}

  getStatus(): MicrophoneStatus { return this.state; }
  getAudio(): AudioState { return { ...this.audio }; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async start(): Promise<void> {
    if (this.stream) return;
    const permissions = this.getPermissions();
    if (!permissions) throw new VoiceError('MICROPHONE_PERMISSION_DENIED', 'Microphone permission controls require Electron.');
    const permission = await permissions.check('MICROPHONE');
    if (permission !== 'GRANTED') throw new VoiceError('MICROPHONE_PERMISSION_DENIED', 'Grant MICROPHONE permission before listening.');
    if (!navigator.mediaDevices?.getUserMedia) throw new VoiceError('MICROPHONE_UNAVAILABLE', 'This platform does not provide microphone capture.');

    this.state = 'starting';
    this.notify();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const track = this.stream.getAudioTracks()[0];
      const settings = track?.getSettings();
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
      this.audio = { amplitude: 0, sampleRate: settings?.sampleRate, channelCount: settings?.channelCount, inputDevice: settings?.deviceId, active: true };
      this.amplitudeTimer = setInterval(() => this.updateAmplitude(), 80);
      this.state = 'active';
      this.notify();
    } catch (error) {
      await this.stop();
      this.state = 'error';
      this.notify();
      if (error instanceof VoiceError) throw error;
      throw new VoiceError('MICROPHONE_ACCESS_ERROR', 'Microphone access could not be started.');
    }
  }

  async stop(): Promise<void> {
    if (this.amplitudeTimer) clearInterval(this.amplitudeTimer);
    this.amplitudeTimer = undefined;
    this.analyser?.disconnect();
    this.analyser = undefined;
    if (this.audioContext && this.audioContext.state !== 'closed') await this.audioContext.close();
    this.audioContext = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.audio = { ...this.audio, amplitude: 0, active: false };
    this.state = 'inactive';
    this.notify();
  }

  async dispose(): Promise<void> { await this.stop(); this.listeners.clear(); }

  private updateAmplitude(): void {
    if (!this.analyser) return;
    const values = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(values);
    let sum = 0;
    values.forEach((value) => { const normalized = (value - 128) / 128; sum += normalized * normalized; });
    this.audio = { ...this.audio, amplitude: Math.min(1, Math.sqrt(sum / values.length) * 3) };
    this.notify();
  }

  private notify(): void { this.listeners.forEach((listener) => listener()); }
}

export type MicrophonePermissionBridge = PermissionBridge;