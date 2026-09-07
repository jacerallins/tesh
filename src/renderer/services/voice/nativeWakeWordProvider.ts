import { VoiceError, type WakeWordProvider } from '../../../shared/voice';

export class NativeWakeWordProvider implements WakeWordProvider {
  private stream?: MediaStream;
  private context?: AudioContext;
  private processor?: ScriptProcessorNode;
  private gain?: GainNode;

  constructor(public readonly phrase: string) {}

  async start(): Promise<void> {
    const bridge = window.tesh?.voice;
    if (!bridge) throw new VoiceError('WAKE_WORD_UNAVAILABLE', 'Native wake-word bridge is unavailable.');
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new VoiceError('MICROPHONE_UNAVAILABLE', 'Microphone capture is unavailable.');
    try {
      await bridge.start(this.phrase);
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.context = new AudioContext();
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      const source = this.context.createMediaStreamSource(this.stream);
      source.connect(this.processor);
      this.processor.connect(this.gain);
      this.gain.connect(this.context.destination);
      const inputRate = this.context.sampleRate;
      this.processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const outputLength = Math.max(1, Math.floor(input.length * 16000 / inputRate));
        const output = new Float32Array(outputLength);
        const ratio = inputRate / 16000;
        for (let i = 0; i < outputLength; i += 1) {
          const position = i * ratio;
          const left = Math.floor(position);
          const right = Math.min(left + 1, input.length - 1);
          const weight = position - left;
          output[i] = input[left] * (1 - weight) + input[right] * weight;
        }
        void bridge.sendAudio(output.buffer, 16000);
      };
      if (this.context.state === 'suspended') await this.context.resume();
    } catch (error) {
      await this.stop();
      const code = error instanceof VoiceError ? error.code : 'WAKE_WORD_UNAVAILABLE';
      throw new VoiceError(code === 'MICROPHONE_UNAVAILABLE' ? code : 'WAKE_WORD_UNAVAILABLE', error instanceof Error ? error.message : 'Native wake-word engine could not start.');
    }
  }

  async stop(): Promise<void> {
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.gain?.disconnect();
    this.processor = undefined;
    this.gain = undefined;
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    await window.tesh?.voice?.stop();
  }

  onDetected(callback: () => void): () => void {
    const bridge = window.tesh?.voice;
    if (!bridge) throw new VoiceError('WAKE_WORD_UNAVAILABLE', 'Native wake-word bridge is unavailable.');
    return bridge.onDetected(callback);
  }
}
