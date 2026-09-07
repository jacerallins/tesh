import { useEffect, useState } from 'react';
import type { ReactElement, FormEvent } from 'react';
import type { CreateMemoryInput, Memory, MemoryCandidate, MemoryCategory, MemoryImportance, MemorySource } from '../../../shared/memoryTypes';

const categories: readonly MemoryCategory[] = ['WORKING', 'PROJECT', 'PREFERENCE', 'GOAL', 'DECISION', 'FACT', 'EPISODIC', 'ARCHIVED', 'ROUTINE', 'COMMUNICATION_STYLE', 'RELATIONSHIP_CONTEXT', 'USER_INSTRUCTION'];
const importanceLevels: readonly MemoryImportance[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const sources: readonly MemorySource[] = ['USER_PROVIDED', 'USER_EXPLICIT', 'USER_APPROVED', 'SYSTEM', 'PROJECT', 'CONVERSATION', 'IMPORTED', 'DEVELOPMENT'];

const emptyDraft: CreateMemoryInput = { content: '', category: 'FACT', importance: 'NORMAL', source: 'USER_PROVIDED', tags: [] };

export function MemoryPanel(): ReactElement | null {
  const memoryBridge = window.tesh?.memory;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [draft, setDraft] = useState<CreateMemoryInput>(emptyDraft);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);

  const load = async (): Promise<void> => { if (memoryBridge) { setMemories(query.trim() ? await memoryBridge.search({ query }) : await memoryBridge.list()); setCandidates(await memoryBridge.intelligence.listCandidates()); } };
  useEffect(() => { void load(); }, [memoryBridge]);

  if (!memoryBridge) return <section className="memory-panel preview-panel" aria-label="Memory management preview"><div className="memory-heading"><div><p className="panel-label">Development preview</p><h2>Local memory</h2></div><span>Electron IPC required</span></div><p className="preview-copy">Memory controls are available in the Electron development window. This browser preview cannot access the local SQLite database.</p></section>;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!draft.content.trim()) return;
    if (editingId) await memoryBridge.update(editingId, draft); else await memoryBridge.create(draft);
    setDraft(emptyDraft); setEditingId(undefined); setMessage(editingId ? 'Memory updated.' : 'Memory created.'); await load();
  };

  const edit = (memory: Memory): void => { setEditingId(memory.id); setDraft({ content: memory.content, category: memory.category, importance: memory.importance, source: memory.source, tags: memory.tags, projectId: memory.projectId, metadata: memory.metadata }); };
  const remove = async (memory: Memory): Promise<void> => { await memoryBridge.delete(memory.id); setMessage('Memory deleted.'); await load(); };
  const toggleArchive = async (memory: Memory): Promise<void> => { if (memory.archived) await memoryBridge.restore(memory.id); else await memoryBridge.archive(memory.id); await load(); };

  return (
    <section className="memory-panel" aria-label="Development memory management">
      <div className="memory-heading"><div><p className="panel-label">Development only</p><h2>Local memory</h2></div><span>{memories.length} visible</span></div>
      <form className="memory-form" onSubmit={(event) => void submit(event)}>
        <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Create an explicit memory" aria-label="Memory content" maxLength={10000} />
        <div className="memory-fields">
          <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MemoryCategory })} aria-label="Memory category">{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: event.target.value as MemoryImportance })} aria-label="Memory importance">{importanceLevels.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value as MemorySource })} aria-label="Memory source">{sources.map((item) => <option key={item}>{item}</option>)}</select>
          <button type="submit">{editingId ? 'Update' : 'Create'}</button>
          {editingId ? <button type="button" onClick={() => { setEditingId(undefined); setDraft(emptyDraft); }}>Cancel</button> : null}
        </div>
      </form>
      <div className="memory-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} placeholder="Search local memories" aria-label="Search memories" /><button type="button" onClick={() => void load()}>Search</button></div>
      <div className="memory-list">{memories.map((memory) => <article className={memory.archived ? 'memory-item archived' : 'memory-item'} key={memory.id}><p>{memory.content}</p><small>ACTIVE MEMORY · {memory.category} · {memory.importance} · {memory.source}</small><div><button type="button" onClick={() => edit(memory)}>Edit</button><button type="button" onClick={() => void toggleArchive(memory)}>{memory.archived ? 'Restore' : 'Archive'}</button><button type="button" onClick={() => void remove(memory)}>Delete</button></div></article>)}{candidates.map((candidate) => <article className="memory-item candidate" key={candidate.id}><p>{candidate.content}</p><small>CANDIDATE MEMORY · {candidate.category} · confidence {candidate.confidence.toFixed(2)} · {candidate.reason}</small><div><button type="button" onClick={() => void memoryBridge.intelligence.approveCandidate(candidate.id).then(load)}>Remember</button><button type="button" onClick={() => void memoryBridge.intelligence.rejectCandidate(candidate.id).then(load)}>Not now</button></div></article>)}</div>
      <p className="memory-message" aria-live="polite">{message}</p>
    </section>
  );
}
