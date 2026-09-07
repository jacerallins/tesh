import { randomUUID } from 'node:crypto';
import type { AIConversationBridge, AIMessage, AIProviderConfig, ConversationSnapshot, ConversationStartResult, ToolRequest } from '../../shared/aiTypes';
import { buildContext } from './contextManager';
import { buildTeshSystemPrompt } from './systemPrompt';
import type { AIProvider, AIProviderError } from './aiProvider';
import { toolDefinitions, ToolExecutor } from './toolExecutor';
import type { Memory } from '../../shared/memoryTypes';
import type { ConversationRepository } from './conversationRepository';
import type { PersonalityProfile } from '../../shared/personalityTypes';

const defaultPersonality: PersonalityProfile = { formality: 'MEDIUM', warmth: 'HIGH', humor: 'MEDIUM', expressiveness: 'HIGH', verbosity: 'MEDIUM', proactive: 'MEDIUM' };
export class ConversationService implements AIConversationBridge {
  private readonly conversations = new Map<string, ConversationSnapshot>(); private readonly controllers = new Map<string, AbortController>(); private readonly busyConversations = new Set<string>();
  constructor(private readonly provider: AIProvider, private readonly tools: ToolExecutor, private readonly retrieveMemory: (query: string) => Promise<Memory[]> = async () => [], private readonly repository?: ConversationRepository, private readonly getPersonality: () => Promise<PersonalityProfile> = async () => defaultPersonality) { if (repository) for (const conversation of repository.list(100)) this.conversations.set(conversation.id, conversation); }
  async start(): Promise<ConversationStartResult> { const now = new Date().toISOString(); const id = randomUUID(); const snapshot: ConversationSnapshot = { id, messages: [], status: 'IDLE', provider: this.provider.name, model: this.provider.config.model, createdAt: now, updatedAt: now }; this.conversations.set(id, snapshot); this.persist(snapshot); return { conversationId: id, snapshot }; }
  async send(conversationId: string, content: string): Promise<ConversationSnapshot> {
    const conversation = this.getConversation(conversationId); if (!content.trim() || content.length > 10000) throw new Error('Message content is invalid.'); if (this.busyConversations.has(conversationId)) throw new Error('Conversation is already processing another request.'); this.busyConversations.add(conversationId);
    const user: AIMessage = { id: randomUUID(), role: 'USER', content: content.trim(), timestamp: new Date().toISOString() }; conversation.messages.push(user); conversation.status = 'GENERATING'; conversation.lastError = undefined; this.persist(conversation);
    const controller = new AbortController(); this.controllers.set(conversationId, controller); const started = Date.now();
    try {
      const memories = await this.retrieveMemory(user.content); const memoryContext = memories.map(memory => `[${memory.category}/${memory.importance}] ${memory.content}`).join('\n'); const personality = await this.getPersonality(); const prompt = buildTeshSystemPrompt(personality);
      const response = await this.provider.generate(buildContext(conversation.messages, prompt, memoryContext), [...toolDefinitions], controller.signal); conversation.lastLatencyMs = Date.now() - started;
      if (!response.toolRequest) return this.completeResponse(conversation, response.content);
      const request: ToolRequest = { id: randomUUID(), toolId: response.toolRequest.toolId, input: response.toolRequest.input }; const result = await this.tools.execute(request); conversation.pendingTool = result.status === 'REQUIRES_CONFIRMATION' ? request : undefined; conversation.lastToolResult = result;
      if (result.status === 'REQUIRES_CONFIRMATION') { conversation.status = 'AWAITING_CONFIRMATION'; this.persist(conversation); return conversation; }
      conversation.messages.push({ id: randomUUID(), role: 'TOOL', content: result.content, timestamp: new Date().toISOString(), toolCallId: request.id, toolName: request.toolId });
      if (result.status !== 'SUCCESS') { conversation.status = 'IDLE'; this.persist(conversation); return conversation; }
      const followUp = await this.provider.generate(buildContext(conversation.messages, prompt, memoryContext), [...toolDefinitions], controller.signal); if (followUp.toolRequest) { conversation.status = 'ERROR'; conversation.lastError = 'AI_INVALID_RESPONSE'; this.persist(conversation); return conversation; }
      return this.completeResponse(conversation, followUp.content);
    } catch (error) { const providerError = error as AIProviderError; conversation.status = 'ERROR'; conversation.lastError = providerError.code ?? 'AI_REQUEST_FAILED'; this.persist(conversation); return conversation; } finally { this.controllers.delete(conversationId); this.busyConversations.delete(conversationId); }
  }
  async cancel(conversationId: string): Promise<void> { this.controllers.get(conversationId)?.abort(); this.provider.cancel(); const conversation = this.getConversation(conversationId); conversation.status = 'ERROR'; conversation.lastError = 'AI_CANCELLED'; this.persist(conversation); }
  async confirmTool(conversationId: string, requestId: string, approved: boolean): Promise<ConversationSnapshot> { const conversation = this.getConversation(conversationId); const request = conversation.pendingTool; if (!request || request.id !== requestId) throw new Error('Tool confirmation is invalid.'); if (!approved) { conversation.pendingTool = undefined; conversation.status = 'IDLE'; conversation.lastToolResult = { requestId, toolId: request.toolId, status: 'DENIED', content: 'User did not approve the tool request.', authorizationResult: 'DENIED', confirmationRequired: true }; this.persist(conversation); return conversation; } const result = await this.tools.execute(request, true); conversation.pendingTool = undefined; conversation.lastToolResult = result; conversation.status = 'IDLE'; conversation.messages.push({ id: randomUUID(), role: 'TOOL', content: result.content, timestamp: new Date().toISOString(), toolCallId: request.id, toolName: request.toolId }); this.persist(conversation); return conversation; }
  async list(limit = 50): Promise<ConversationSnapshot[]> { return [...this.conversations.values()].sort((a,b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? '')).slice(0, Math.min(Math.max(limit,1),100)); }
  async get(id: string): Promise<ConversationSnapshot> { return this.getConversation(id); }
  async getConfig(): Promise<AIProviderConfig> { return { ...this.provider.config }; }
  async getStatus(): Promise<{ configured: boolean; provider: string; model: string }> { return { configured: this.provider.configured ?? Boolean(process.env.TESH_AI_API_KEY), provider: this.provider.name, model: this.provider.config.model }; }
  private completeResponse(conversation: ConversationSnapshot, content: string): ConversationSnapshot { conversation.messages.push({ id: randomUUID(), role: 'ASSISTANT', content, timestamp: new Date().toISOString() }); conversation.status = 'IDLE'; this.persist(conversation); return conversation; }
  private getConversation(id: string): ConversationSnapshot { const conversation = this.conversations.get(id) ?? this.repository?.get(id) ?? null; if (!conversation) throw new Error('Conversation was not found.'); this.conversations.set(id, conversation); return conversation; }
  private persist(conversation: ConversationSnapshot): void { this.repository?.save(conversation); }
}
