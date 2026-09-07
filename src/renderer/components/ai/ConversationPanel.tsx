import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { ConversationSnapshot } from '../../../shared/aiTypes';

export function ConversationPanel(): ReactElement | null {
  const bridge = window.tesh?.conversation;
  const [snapshot, setSnapshot] = useState<ConversationSnapshot>();
  const [conversationId, setConversationId] = useState('');
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('Loading provider...');
  const [error, setError] = useState('');
  useEffect(() => { if (!bridge) return; void bridge.getConfig().then((config) => setProvider(`${config.provider} · ${config.model}`)); void bridge.start().then((result) => { setConversationId(result.conversationId); setSnapshot(result.snapshot); }); }, [bridge]);
  if (!bridge) return null;
  const send = async (): Promise<void> => { if (!input.trim() || !conversationId) return; setError(''); const result = await bridge.send(conversationId, input); setInput(''); setSnapshot(result); if (result.status === 'ERROR') setError(result.lastError || 'AI request failed.'); };
  const confirm = async (approved: boolean): Promise<void> => { if (!snapshot?.pendingTool || !conversationId) return; setSnapshot(await bridge.confirmTool(conversationId, snapshot.pendingTool.id, approved)); };
  return <section className="ai-panel" aria-label="Development AI conversation panel"><div className="memory-heading"><div><p className="panel-label">Development only</p><h2>Conversation engine</h2></div><span>{provider}</span></div><div className="conversation-status"><span>Status: {snapshot?.status || 'Starting'}</span><span>Latency: {snapshot?.lastLatencyMs ? `${snapshot.lastLatencyMs} ms` : 'n/a'}</span></div><div className="conversation-messages">{snapshot?.messages.map((message) => <article key={message.id} className={`conversation-message ${message.role.toLowerCase()}`}><span className="panel-label">{message.role}</span><p>{message.content}</p></article>)}</div>{snapshot?.pendingTool ? <div className="tool-confirmation"><p>Tool request: {snapshot.pendingTool.toolId}</p><button type="button" onClick={() => void confirm(true)}>Approve tool</button><button type="button" onClick={() => void confirm(false)}>Reject tool</button></div> : null}<div className="conversation-input"><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Tesh something" aria-label="Conversation input" /><button type="button" onClick={() => void send()}>Send</button><button type="button" onClick={() => void bridge.cancel(conversationId)}>Cancel</button></div><p className="memory-message" aria-live="polite">{error || 'Provider receives text context only. Credentials and privileged APIs remain in the main process.'}</p></section>;
}