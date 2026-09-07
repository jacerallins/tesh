import type { AIMessage, AIProviderConfig, ToolDefinition } from '../../shared/aiTypes';
import { AIProviderError, OpenAICompatibleProvider, type AIProvider, type AIProviderResponse } from './aiProvider';

export type AIRuntimeMode = 'auto' | 'online' | 'offline';

function readMode(): AIRuntimeMode {
  const value = process.env.TESH_AI_MODE?.toLowerCase();
  return value === 'online' || value === 'offline' ? value : 'auto';
}

function localConfig(): AIProviderConfig {
  return {
    provider: 'offline-local',
    model: process.env.TESH_LOCAL_AI_MODEL ?? 'llama3.2:3b',
    endpoint: process.env.TESH_LOCAL_AI_ENDPOINT ?? 'http://127.0.0.1:11434/v1/chat/completions',
    temperature: 0.4,
    maxOutputTokens: 800,
    streaming: false,
    timeoutMs: Number(process.env.TESH_LOCAL_AI_TIMEOUT_MS ?? 30000)
  };
}

/** Routes requests between the configured online provider and a local OpenAI-compatible model server. */
export class AIRouter implements AIProvider {
  readonly name = 'Tesh AI router';
  readonly config: AIProviderConfig;
  readonly configured: boolean;
  private readonly mode: AIRuntimeMode;
  private readonly online: OpenAICompatibleProvider;
  private readonly offline: OpenAICompatibleProvider;

  constructor(onlineConfig: AIProviderConfig, apiKey = process.env.TESH_AI_API_KEY, shouldFail: () => boolean = () => false) {
    this.mode = readMode();
    this.online = new OpenAICompatibleProvider(onlineConfig, apiKey, shouldFail);
    this.offline = new OpenAICompatibleProvider(localConfig(), '', () => false);
    this.config = this.mode === 'offline' ? this.offline.config : { ...onlineConfig, provider: 'hybrid' };
    this.configured = this.mode === 'offline' || Boolean(apiKey);
  }

  async generate(messages: AIMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<AIProviderResponse> {
    if (this.mode === 'offline') return this.offline.generate(messages, tools, signal);
    if (this.mode === 'online') return this.online.generate(messages, tools, signal);

    try {
      return await this.online.generate(messages, tools, signal);
    } catch (error) {
      const providerError = error instanceof AIProviderError ? error : undefined;
      if (providerError && !['AI_PROVIDER_UNAVAILABLE', 'AI_TIMEOUT', 'AI_REQUEST_FAILED', 'AI_RATE_LIMITED'].includes(providerError.code)) throw error;
      return this.offline.generate(messages, tools, signal);
    }
  }

  cancel(): void {
    this.online.cancel();
    this.offline.cancel();
  }
}
