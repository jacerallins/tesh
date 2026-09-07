import type { ToolDefinition, ToolRequest, ToolResult } from '../../shared/aiTypes';
import type { FileService } from '../system/fileService';
import type { SystemService } from '../system/systemService';
import type { CommunicationService } from '../communication/communicationService';

export const toolDefinitions: readonly ToolDefinition[] = [
  { id: 'FILE_READ', name: 'Read text file', description: 'Read an authorized supported text file.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }, requiredCapability: 'file.read', riskLevel: 'NORMAL', requiresConfirmation: false },
  { id: 'FILE_SEARCH', name: 'Search files', description: 'Search within an authorized directory scope.', inputSchema: { type: 'object', properties: { root: { type: 'string' }, query: { type: 'string' } }, required: ['root'] }, requiredCapability: 'file.read', riskLevel: 'NORMAL', requiresConfirmation: false },
  { id: 'FILE_DISPLAY', name: 'Display file', description: 'Open an authorized file for the user.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }, requiredCapability: 'file.display', riskLevel: 'NORMAL', requiresConfirmation: false },
  { id: 'FILE_CREATE', name: 'Create file', description: 'Create a new authorized text file without overwriting.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }, requiredCapability: 'file.create', riskLevel: 'NORMAL', requiresConfirmation: false },
  { id: 'FILE_RENAME', name: 'Rename file', description: 'Rename an authorized file within scope.', inputSchema: { type: 'object', properties: { source: { type: 'string' }, destination: { type: 'string' } }, required: ['source', 'destination'] }, requiredCapability: 'file.rename', riskLevel: 'NORMAL', requiresConfirmation: false },
  { id: 'FILE_MOVE', name: 'Move file', description: 'Move an authorized file within scope.', inputSchema: { type: 'object', properties: { source: { type: 'string' }, destination: { type: 'string' } }, required: ['source', 'destination'] }, requiredCapability: 'file.move', riskLevel: 'HIGH', requiresConfirmation: false },
  { id: 'FILE_DELETE', name: 'Move file to trash', description: 'Move an authorized file to the operating system trash after confirmation.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }, requiredCapability: 'file.delete', riskLevel: 'CRITICAL', requiresConfirmation: true },
  { id: 'SYSTEM_DIAGNOSTICS', name: 'Read system diagnostics', description: 'Read safe local system diagnostics.', inputSchema: { type: 'object', properties: {} }, requiredCapability: 'system.diagnostics', riskLevel: 'NORMAL', requiresConfirmation: false }
  ,{ id: 'resolve_contact', name: 'Resolve contact', description: 'Find a contact without sending communication.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, requiredCapability: 'contact.read', riskLevel: 'NORMAL', requiresConfirmation: false },
  { id: 'create_message_draft', name: 'Create message draft', description: 'Create a draft that must be shown and confirmed before sending.', inputSchema: { type: 'object', properties: { recipientQuery: { type: 'string' }, content: { type: 'string' } }, required: ['recipientQuery', 'content'] }, requiredCapability: 'message.draft', riskLevel: 'NORMAL', requiresConfirmation: false }
];

export class ToolExecutor {
  constructor(private readonly files: FileService, private readonly system: SystemService, private readonly communication?: CommunicationService) {}
  async execute(request: ToolRequest, confirmed = false): Promise<ToolResult> {
    const definition = toolDefinitions.find((tool) => tool.id === request.toolId);
    if (!definition) return { requestId: request.id, toolId: request.toolId, status: 'DENIED', content: 'Unknown tool.', authorizationResult: 'DENIED', confirmationRequired: false };
    try {
      let content: unknown;
      if (request.toolId === 'FILE_READ') content = await this.files.read(this.stringInput(request, 'path'));
      else if (request.toolId === 'FILE_SEARCH') content = await this.files.search({ root: this.stringInput(request, 'root'), query: this.optionalString(request, 'query'), limit: 50 });
      else if (request.toolId === 'FILE_DISPLAY') content = await this.files.display(this.stringInput(request, 'path'));
      else if (request.toolId === 'FILE_CREATE') content = await this.files.create({ path: this.stringInput(request, 'path'), content: this.stringInput(request, 'content') });
      else if (request.toolId === 'FILE_RENAME') content = await this.files.rename({ source: this.stringInput(request, 'source'), destination: this.stringInput(request, 'destination') });
      else if (request.toolId === 'FILE_MOVE') content = await this.files.move({ source: this.stringInput(request, 'source'), destination: this.stringInput(request, 'destination') });
      else if (request.toolId === 'FILE_DELETE') content = await this.files.delete({ path: this.stringInput(request, 'path'), confirmed });
      else if (request.toolId === 'SYSTEM_DIAGNOSTICS') content = await this.system.getDiagnostics();
      else if (request.toolId === 'resolve_contact') content = await this.communication?.resolveRecipient(this.stringInput(request, 'query'));
      else if (request.toolId === 'create_message_draft') content = await this.communication?.createDraft({ recipientQuery: this.stringInput(request, 'recipientQuery'), content: this.stringInput(request, 'content') });
      else return { requestId: request.id, toolId: request.toolId, status: 'DENIED', content: 'Unknown tool.', authorizationResult: 'DENIED', confirmationRequired: false };
      return { requestId: request.id, toolId: request.toolId, status: 'SUCCESS', content: JSON.stringify(content), authorizationResult: 'ALLOWED', confirmationRequired: definition.requiresConfirmation };
    } catch (error) { const code = (error as { code?: string }).code; if (code === 'DELETE_REQUIRES_CONFIRMATION') return { requestId: request.id, toolId: request.toolId, status: 'REQUIRES_CONFIRMATION', content: 'Explicit confirmation is required.', authorizationResult: 'REQUIRES_CONFIRMATION', confirmationRequired: true }; return { requestId: request.id, toolId: request.toolId, status: 'ERROR', content: error instanceof Error ? error.message : 'Tool execution failed.', authorizationResult: 'DENIED', confirmationRequired: definition.requiresConfirmation }; }
  }
  private stringInput(request: ToolRequest, key: string): string { const value = request.input[key]; if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new Error('Tool input is invalid.'); return value; }
  private optionalString(request: ToolRequest, key: string): string | undefined { const value = request.input[key]; if (value === undefined) return undefined; return this.stringInput(request, key); }
}