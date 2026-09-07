import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserTTSProvider } from './ttsProvider';

class FakeUtterance {
  lang = '';
  rate = 0;
  pitch = 0;
  volume = 0;
  voice: unknown = null;
  onend?: () => void;
  onerror?: () => void;
  constructor(readonly text: string) {}
}

class FakeSynthesis {
  utterances: FakeUtterance[] = [];
  speak = vi.fn((utterance: FakeUtterance) => { this.utterances.push(utterance); });
  cancel = vi.fn(() => { this.utterances.at(-1)?.onerror?.(); });
  pause = vi.fn();
  resume = vi.fn();
  getVoices = vi.fn(() => []);
}

let synthesis: FakeSynthesis;

afterEach(() => vi.unstubAllGlobals());

describe('BrowserTTSProvider', () => {
  it('treats intentional cancellation as a successful stop', async () => {
    synthesis = new FakeSynthesis();
    vi.stubGlobal('window', { speechSynthesis: synthesis });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const provider = new BrowserTTSProvider();

    const speaking = provider.speak('Hello Tesh.');
    await provider.stop();

    await expect(speaking).resolves.toBeUndefined();
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it('passes configured speech options through to the browser', async () => {
    synthesis = new FakeSynthesis();
    vi.stubGlobal('window', { speechSynthesis: synthesis });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const provider = new BrowserTTSProvider();

    const speaking = provider.speak('Hello Tesh.', { language: 'en-US', rate: 1, pitch: 0.8, volume: 0.7 });
    synthesis.utterances[0]!.onend?.();
    await speaking;

    const utterance = synthesis.utterances[0]!;
    expect(utterance.lang).toBe('en-US');
    expect(utterance.rate).toBe(1);
    expect(utterance.pitch).toBe(0.8);
    expect(utterance.volume).toBe(0.7);
  });
});