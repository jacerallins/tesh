import { describe, expect, it } from 'vitest';
import type { AIMessage, AIProviderConfig, ToolRequest, ToolResult } from '../shared/aiTypes';
import type { Memory } from '../shared/memoryTypes';
import type { AIProvider, AIProviderResponse } from './ai/aiProvider';
import { ConversationService } from './ai/conversationService';
import type { ToolExecutor } from './ai/toolExecutor';

const config: AIProviderConfig = { provider: 'mock', model: 'integration', endpoint: 'mock://local', temperature: 0, maxOutputTokens: 100, streaming: false, timeoutMs: 500 };

class PipelineProvider implements AIProvider {
  readonly name = 'Integration mock';
  readonly config = config;
  private turn = 0;
  async generate(messages: AIMessage[], _tools: never[], _signal?: AbortSignal): Promise<AIProviderResponse> {
    this.turn += 1;
    if (this.turn === 1) return { content: '', toolRequest: { toolId: 'FILE_SEARCH', input: { root: 'C:\\workspace', query: 'proposal' } } };
    expect(messages.at(-1)?.role).toBe('TOOL');
    return { content: 'The proposal is in README.md.' };
  }
  cancel(): void { }
}

class IntegrationTools {
  requests: ToolRequest[] = [];
  async execute(request: ToolRequest): Promise<ToolResult> {
    this.requests.push(request);
    return { requestId: request.id, toolId: request.toolId, status: 'SUCCESS', content: JSON.stringify([{ path: 'C:\\workspace\\README.md' }]), authorizationResult: 'ALLOWED', confirmationRequired: false };
  }
}

describe('Milestone 12 composed conversation pipeline', () => {
  it('retrieves approved memory, authorizes a file tool, and produces the final response', async () => {
    const memory: Memory = { id: 'memory-1', content: 'The project is called Tesh.', category: 'FACT', importance: 'HIGH', source: 'USER_APPROVED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [], archived: false, metadata: {} };
    const tools = new IntegrationTools();
    const service = new ConversationService(new PipelineProvider(), tools as unknown as ToolExecutor, async (query) => { expect(query).toContain('proposal'); return [memory]; });
    const started = await service.start();
    const result = await service.send(started.conversationId, 'Tesh, find my project proposal.');
    expect(tools.requests[0]?.toolId).toBe('FILE_SEARCH');
    expect(result.status).toBe('IDLE');
    expect(result.messages.at(-1)?.content).toBe('The proposal is in README.md.');
  });
});
