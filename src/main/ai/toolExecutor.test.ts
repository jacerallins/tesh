import { describe, expect, it } from 'vitest';
import { ToolExecutor } from './toolExecutor';
import { toolDefinitions } from './toolExecutor';

describe('ToolExecutor', () => {
  it('rejects a nonexistent tool without invoking a service', async () => {
    const executor = new ToolExecutor({} as never, {} as never);
    const result = await executor.execute({ id: 'request-1', toolId: 'EXECUTE_SHELL', input: { command: 'whoami' } });
    expect(result.status).toBe('DENIED');
    expect(result.content).toBe('Unknown tool.');
  });

  it('exposes draft communication tools but never a send tool', () => {
    expect(toolDefinitions.some((tool) => tool.id === 'create_message_draft')).toBe(true);
    expect(toolDefinitions.some((tool) => tool.id === 'send_message')).toBe(false);
  });
});