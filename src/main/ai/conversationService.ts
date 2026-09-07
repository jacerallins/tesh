import { randomUUID } from 'node:crypto';
import type { AIConversationBridge, AIMessage, AIProviderConfig, ConversationSnapshot, ConversationStartResult, ToolRequest } from '../../shared/aiTypes';
import { buildContext } from './contextManager';
import { aiConfig } from './aiConfig';
import { TESH_SYSTEM_PROMPT } from './systemPrompt';
import type { AIProvider, AIProviderError } from './aiProvider';
import { toolDefinitions, ToolExecutor } from './toolExecutor';
import type { Memory } from '../../shared/memoryTypes';

export class ConversationService implements AIConversationBridge {
  private readonly conversations = new Map<string, ConversationSnapshot>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly busyConversations = new Set<string>();
  constructor(private readonly provider: AIProvider, private readonly tools: ToolExecutor, private readonly retrieveMemory: (query: string) => Promise<Memory[]> = async () => []) {}
  async start(): Promise<ConversationStartResult> { const id = randomUUID(); const snapshot: ConversationSnapshot = { id, messages: [], status: 'IDLE', provider: this.provider.name, model: this.provider.config.model }; this.conversations.set(id, snapshot); return { conversationId: id, snapshot }; }
  async send(conversationId: string, content: string): Promise<ConversationSnapshot> {
    const conversation = this.get(conversationId);
    if (!content.trim() || content.length > 10000) throw new Error('Message content is invalid.');
    if (this.busyConversations.has(conversationId)) throw new Error('Conversation is already processing another request.');
    this.busyConversations.add(conversationId);
    const user: AIMessage = { id: randomUUID(), role: 'USER', content: content.trim(), timestamp: new Date().toISOString() };
    conversation.messages.push(user); conversation.status = 'GENERATING'; conversation.lastError = undefined;
    const controller = new AbortController(); this.controllers.set(conversationId, controller); const started = Date.now();
    try {
      const memories = await this.retrieveMemory(user.content);
      const memoryContext = memories.map((memory) => `[${memory.category}/${memory.importance}] ${memory.content}`).join('\n');
      const response = await this.provider.generate(buildContext(conversation.messages, TESH_SYSTEM_PROMPT, memoryContext), [...toolDefinitions], controller.signal);
      conversation.lastLatencyMs = Date.now() - started;
      if (!response.toolRequest) return this.completeResponse(conversation, response.content);

      const request: ToolRequest = { id: randomUUID(), toolId: response.toolRequest.toolId, input: response.toolRequest.input };
      const result = await this.tools.execute(request);
      conversation.pendingTool = result.status === 'REQUIRES_CONFIRMATION' ? request : undefined;
      conversation.lastToolResult = result;
      if (result.status === 'REQUIRES_CONFIRMATION') {
        conversation.status = 'AWAITING_CONFIRMATION';
        return conversation;
      }
      conversation.messages.push({ id: randomUUID(), role: 'TOOL', content: result.content, timestamp: new Date().toISOString(), toolCallId: request.id, toolName: request.toolId });
      if (result.status !== 'SUCCESS') {
        conversation.status = 'IDLE';
        return conversation;
      }

      const followUp = await this.provider.generate(buildContext(conversation.messages, TESH_SYSTEM_PROMPT, memoryContext), [...toolDefinitions], controller.signal);
      if (followUp.toolRequest) {
        conversation.status = 'ERROR';
        conversation.lastError = 'AI_INVALID_RESPONSE';
        return conversation;
      }
      return this.completeResponse(conversation, followUp.content);
    } catch (error) { const providerError = error as AIProviderError; conversation.status = 'ERROR'; conversation.lastError = providerError.code ?? 'AI_REQUEST_FAILED'; return conversation; } finally { this.controllers.delete(conversationId); this.busyConversations.delete(conversationId); }
  }
  async cancel(conversationId: string): Promise<void> { this.controllers.get(conversationId)?.abort(); this.provider.cancel(); const conversation = this.get(conversationId); conversation.status = 'ERROR'; conversation.lastError = 'AI_CANCELLED'; }
  async confirmTool(conversationId: string, requestId: string, approved: boolean): Promise<ConversationSnapshot> { const conversation = this.get(conversationId); const request = conversation.pendingTool; if (!request || request.id !== requestId) throw new Error('Tool confirmation is invalid.'); if (!approved) { conversation.pendingTool = undefined; conversation.status = 'IDLE'; conversation.lastToolResult = { requestId, toolId: request.toolId, status: 'DENIED', content: 'User did not approve the tool request.', authorizationResult: 'DENIED', confirmationRequired: true }; return conversation; } const result = await this.tools.execute(request, true); conversation.pendingTool = undefined; conversation.lastToolResult = result; conversation.status = 'IDLE'; conversation.messages.push({ id: randomUUID(), role: 'TOOL', content: result.content, timestamp: new Date().toISOString(), toolCallId: request.id, toolName: request.toolId }); return conversation; }
  async getConfig(): Promise<AIProviderConfig> { return { ...aiConfig }; }
  async getStatus(): Promise<{ configured: boolean; provider: string; model: string }> { return { configured: Boolean(process.env.TESH_AI_API_KEY), provider: this.provider.name, model: this.provider.config.model }; }
  private completeResponse(conversation: ConversationSnapshot, content: string): ConversationSnapshot { conversation.messages.push({ id: randomUUID(), role: 'ASSISTANT', content, timestamp: new Date().toISOString() }); conversation.status = 'IDLE'; return conversation; }
  private get(id: string): ConversationSnapshot { const conversation = this.conversations.get(id); if (!conversation) throw new Error('Conversation was not found.'); return conversation; }
}