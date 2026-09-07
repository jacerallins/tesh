import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIProviderConfig } from '../../shared/aiTypes';
import { AIRouter } from './aiRouter';

const onlineConfig: AIProviderConfig = { provider: 'openai-compatible', model: 'online-test', endpoint: 'https://online.test/v1/chat/completions', temperature: 0, maxOutputTokens: 10, streaming: false, timeoutMs: 1000 };

function response(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('AIRouter', () => {
  it('uses online AI in online mode', async () => {
    vi.stubEnv('TESH_AI_MODE', 'online');
    const fetchMock = vi.fn(async () => response('online'));
    vi.stubGlobal('fetch', fetchMock);
    const router = new AIRouter(onlineConfig, 'online-key');
    await expect(router.generate([], [])).resolves.toMatchObject({ content: 'online' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the local endpoint in offline mode without an API key', async () => {
    vi.stubEnv('TESH_AI_MODE', 'offline');
    vi.stubEnv('TESH_LOCAL_AI_ENDPOINT', 'http://127.0.0.1:12345/v1/chat/completions');
    vi.stubEnv('TESH_LOCAL_AI_MODEL', 'local-test');
    const fetchMock = vi.fn(async () => response('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const router = new AIRouter(onlineConfig);
    await expect(router.generate([], [])).resolves.toMatchObject({ content: 'offline' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { 'Content-Type': 'application/json' } });
    expect(router.config.provider).toBe('offline-local');
    expect(router.config.model).toBe('local-test');
  });

  it('falls back to local AI in auto mode when the online provider is unavailable', async () => {
    vi.stubEnv('TESH_AI_MODE', 'auto');
    vi.stubEnv('TESH_LOCAL_AI_ENDPOINT', 'http://localhost:12345/v1/chat/completions');
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(response('local fallback'));
    vi.stubGlobal('fetch', fetchMock);
    const router = new AIRouter(onlineConfig, 'online-key');
    await expect(router.generate([], [])).resolves.toMatchObject({ content: 'local fallback' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
