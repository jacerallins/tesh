import { describe, expect, it } from 'vitest';
import { OpenAICompatibleProvider } from './aiProvider';

describe('OpenAICompatibleProvider', () => {
  it('fails closed when the main-process API key is unavailable', async () => {
    const provider = new OpenAICompatibleProvider({ provider: 'test', model: 'test', endpoint: 'http://localhost', temperature: 0, maxOutputTokens: 10, streaming: false, timeoutMs: 10 }, undefined);
    await expect(provider.generate([], [])).rejects.toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE' });
  });
});