import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSpeechRecognitionProvider } from './speechRecognitionProvider';

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult?: (event: { results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } }; resultIndex: number }) => void;
  onerror?: () => void;
  onend?: () => void;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  emitResult(result: { isFinal: boolean; transcript: string }): void { this.onresult?.({ results: { length: 1, 0: { isFinal: result.isFinal, 0: { transcript: result.transcript } } }, resultIndex: 0 }); }
  emitEnd(): void { this.onend?.(); }
}

let instance: FakeRecognition | undefined;
class FakeRecognitionConstructor extends FakeRecognition { constructor() { super(); instance = this; } }

afterEach(() => { vi.unstubAllGlobals(); instance = undefined; vi.clearAllMocks(); });

describe('BrowserSpeechRecognitionProvider', () => {
  it('emits interim and final recognition results', async () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognitionConstructor });
    const provider = new BrowserSpeechRecognitionProvider('en-US');
    const interim = vi.fn();
    const final = vi.fn();
    provider.onInterimResult(interim);
    provider.onFinalResult(final);

    await provider.start();
    instance!.emitResult({ isFinal: false, transcript: 'hello' });
    instance!.emitResult({ isFinal: true, transcript: 'hello Tesh' });

    expect(interim).toHaveBeenCalledWith('hello');
    expect(final).toHaveBeenCalledWith('hello Tesh');
    expect(instance!.lang).toBe('en-US');
    expect(instance!.continuous).toBe(false);
    expect(instance!.interimResults).toBe(true);
  });

  it('does not let a stale recognition end event clear a newer session', async () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognitionConstructor });
    const provider = new BrowserSpeechRecognitionProvider();
    await provider.start();
    const first = instance!;
    first.emitEnd();
    await provider.start();
    const second = instance!;
    first.emitEnd();
    await provider.stop();
    expect(first).not.toBe(second);
    expect(second.stop).toHaveBeenCalledTimes(1);
  });
});