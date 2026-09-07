import type { AIMessage, AIProviderConfig, ToolDefinition } from '../../shared/aiTypes';

export type AIProviderErrorCode = 'AI_PROVIDER_UNAVAILABLE' | 'AI_AUTHENTICATION_ERROR' | 'AI_RATE_LIMITED' | 'AI_TIMEOUT' | 'AI_INVALID_RESPONSE' | 'AI_REQUEST_FAILED' | 'AI_CANCELLED';
export class AIProviderError extends Error { constructor(readonly code: AIProviderErrorCode, message: string) { super(message); this.name = 'AIProviderError'; } }
export interface AIProviderResponse { content: string; toolRequest?: { toolId: string; input: Record<string, unknown> }; }
export interface AIProvider { readonly name: string; readonly config: AIProviderConfig; readonly configured?: boolean; generate(messages: AIMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<AIProviderResponse>; cancel(): void; }

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'OpenAI-compatible provider';
  readonly configured: boolean;
  private readonly activeControllers = new Set<AbortController>();
  private cancellationGeneration = 0;
  constructor(readonly config: AIProviderConfig, private readonly apiKey = process.env.TESH_AI_API_KEY, private readonly shouldFail: () => boolean = () => false) {
    this.configured = Boolean(this.apiKey) || this.isLocalEndpoint(config.endpoint);
  }
  async generate(messages: AIMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<AIProviderResponse> {
    if (this.shouldFail()) throw new AIProviderError('AI_PROVIDER_UNAVAILABLE', 'Development AI failure.');
    if (!this.apiKey && !this.isLocalEndpoint(this.config.endpoint)) throw new AIProviderError('AI_PROVIDER_UNAVAILABLE', 'AI provider credentials are not configured.');

    const controller = new AbortController();
    const generation = this.cancellationGeneration;
    let timedOut = false;
    this.activeControllers.add(controller);
    const abortFromCaller = (): void => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, this.config.timeoutMs);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      const response = await fetch(this.config.endpoint, { method: 'POST', headers, body: JSON.stringify({ model: this.config.model, temperature: this.config.temperature, max_tokens: this.config.maxOutputTokens, messages: messages.map(({ role, content }) => ({ role: role.toLowerCase(), content })), tools: tools.map((tool) => ({ type: 'function', function: { name: tool.id, description: tool.description, parameters: tool.inputSchema } })) }), signal: controller.signal });
      if (response.status === 401) throw new AIProviderError('AI_AUTHENTICATION_ERROR', 'AI provider authentication failed.');
      if (response.status === 429) throw new AIProviderError('AI_RATE_LIMITED', 'AI provider rate limit reached.');
      if (!response.ok) throw new AIProviderError('AI_REQUEST_FAILED', 'AI provider request failed.');
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }> };
      const message = payload.choices?.[0]?.message;
      if (!message) throw new AIProviderError('AI_INVALID_RESPONSE', 'AI provider returned an invalid response.');
      const call = message.tool_calls?.[0];
      if (call?.function?.name) { let input: Record<string, unknown>; try { input = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>; } catch { throw new AIProviderError('AI_INVALID_RESPONSE', 'AI provider returned invalid tool input.'); } return { content: message.content ?? '', toolRequest: { toolId: call.function.name, input } }; }
      return { content: message.content ?? '' };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if ((error as { name?: string }).name === 'AbortError') {
        if (this.cancellationGeneration !== generation || signal?.aborted) throw new AIProviderError('AI_CANCELLED', 'AI request was cancelled.');
        if (timedOut) throw new AIProviderError('AI_TIMEOUT', 'AI provider request timed out.');
        throw new AIProviderError('AI_REQUEST_FAILED', 'AI provider request was aborted.');
      }
      throw new AIProviderError('AI_REQUEST_FAILED', 'AI provider request could not be completed.');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
      this.activeControllers.delete(controller);
    }
  }
  cancel(): void { this.cancellationGeneration += 1; for (const controller of this.activeControllers) controller.abort(); }
  private isLocalEndpoint(endpoint: string): boolean { try { const url = new URL(endpoint); return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1'; } catch { return false; } }
}
