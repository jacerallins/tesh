import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeshInteractionEngine } from '../../engine/teshInteractionEngine';
import type { VoiceController } from './voiceController';
import { DevelopmentSpeakerVerificationProvider } from './speakerVerificationProvider';
import { DevelopmentWakeWordProvider, WakeWordService } from './wakeWordService';
import { VoiceActivationService, type ActivationSnapshot } from './voiceActivationService';

class FakeVoice {
  starts = 0;
  stops = 0;
  async startListening(): Promise<void> { this.starts += 1; }
  async stopListening(): Promise<void> { this.stops += 1; }
}

function createActivation(timeout = 1000): { activation: VoiceActivationService; speaker: DevelopmentSpeakerVerificationProvider; wake: DevelopmentWakeWordProvider; voice: FakeVoice } {
  const speaker = new DevelopmentSpeakerVerificationProvider();
  const wake = new DevelopmentWakeWordProvider('Tesh Pineapples');
  const voice = new FakeVoice();
  const activation = new VoiceActivationService(new TeshInteractionEngine(), voice as unknown as VoiceController, new WakeWordService(wake), speaker, { wakePhrase: 'Tesh Pineapples', confidenceThreshold: 0.82, failedAttemptLimit: 2, backoffMs: 1000, sessionTimeoutMs: timeout, requiredEnrollmentSamples: 3 });
  return { activation, speaker, wake, voice };
}

describe('VoiceActivationService', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('uses the configurable development wake phrase and stays silent without enrollment', async () => {
    const { activation, wake, voice } = createActivation();
    await activation.start();
    wake.simulateDetection();
    await vi.waitFor(() => expect(activation.getSnapshot().lastResult).toBe('NO_ENROLLMENT'));
    expect(activation.getSnapshot().phase).toBe('IDLE');
    expect(voice.starts).toBe(0);
    await activation.stop();
  });

  it('creates a verified session only after mock enrollment and pass', async () => {
    const { activation, speaker, wake, voice } = createActivation();
    await activation.enrollTestIdentity();
    speaker.setNextAttempt({ result: 'VERIFIED', confidence: 0.95, liveness: 'PASS', method: 'Development mock' });
    await activation.start();
    wake.simulateDetection();
    await vi.waitFor(() => expect(activation.getSnapshot().phase).toBe('LISTENING'));
    expect(activation.getSnapshot().session?.verificationStatus).toBe('VERIFIED');
    expect(voice.starts).toBe(1);
    await activation.stop();
  });

  it('fails silently on a failed speaker result and on liveness failure', async () => {
    const { activation, speaker, wake, voice } = createActivation();
    await activation.enrollTestIdentity();
    await activation.start();
    speaker.setNextAttempt({ result: 'NOT_VERIFIED', liveness: 'UNAVAILABLE', method: 'Development mock' });
    wake.simulateDetection();
    await vi.waitFor(() => expect(activation.getSnapshot().lastResult).toBe('NOT_VERIFIED'));
    speaker.setNextAttempt({ result: 'VERIFIED', confidence: 0.99, liveness: 'FAIL', method: 'Development mock' });
    wake.simulateDetection();
    await vi.waitFor(() => expect(activation.getSnapshot().phase).toBe('BACKOFF'));
    expect(voice.starts).toBe(0);
    expect(activation.getSnapshot().session).toBeUndefined();
    await activation.stop();
  });

  it('enforces failed-attempt backoff and expires verified sessions', async () => {
    const { activation, speaker, wake } = createActivation(500);
    await activation.enrollTestIdentity();
    await activation.start();
    speaker.setNextAttempt({ result: 'VERIFIED', confidence: 1, liveness: 'PASS', method: 'Development mock' });
    wake.simulateDetection();
    await vi.waitFor(() => expect(activation.getSnapshot().phase).toBe('LISTENING'));
    vi.advanceTimersByTime(500);
    expect(activation.getSnapshot().phase).toBe('IDLE');
    expect(activation.getSnapshot().session).toBeUndefined();
    await activation.stop();
  });
});