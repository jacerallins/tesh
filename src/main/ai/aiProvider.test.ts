import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './aiProvider';

const config = { provider: 'test', model: 'test', endpoint: 'http://localhost', temperature: 0, maxOutputTokens: 10, streaming: false, timeoutMs: 1000 } as const;

describe('OpenAICompatibleProvider', () => {
  it('fails closed when a remote provider API key is unavailable', async () => {
    const provider = new OpenAICompatibleProvider({ ...config, endpoint: 'https://api.example.com/v1/chat/completions' }, undefined);
    await expect(provider.generate([], [])).rejects.toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE' });
  });

  it('allows keyless localhost providers for offline AI', () => {
    const provider = new OpenAICompatibleProvider(config, undefined);
    expect(provider.configured).toBe(true);
  });

  it('cancels all active requests without cross-request controller interference', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleProvider(config, 'test-key');
    const first = provider.generate([], []);
    const second = provider.generate([], []);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    provider.cancel();
    await expect(first).rejects.toMatchObject({ code: 'AI_CANCELLED' });
    await expect(second).rejects.toMatchObject({ code: 'AI_CANCELLED' });
    vi.unstubAllGlobals();
  });
});
