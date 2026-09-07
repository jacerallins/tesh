import { useState } from 'react';
import type { ReactElement } from 'react';

export function SystemToolsPanel(): ReactElement | null {
  const bridge = window.tesh?.system;
  const [path, setPath] = useState('');
  const [destination, setDestination] = useState('');
  const [content, setContent] = useState('');
  const [output, setOutput] = useState('');
  if (!bridge) return <section className="system-panel preview-panel" aria-label="System tools preview"><div className="memory-heading"><div><p className="panel-label">Development preview</p><h2>File and system tools</h2></div><span>Electron IPC required</span></div><p className="preview-copy">Filesystem and diagnostics remain unavailable in browser preview. Electron routes every operation through permission, scope, and verified-session checks.</p></section>;
  const run = async (operation: string, action: () => Promise<unknown>): Promise<void> => { try { const result = await action(); setOutput(`${operation}\n${JSON.stringify(result, null, 2)}`); } catch (error) { setOutput(`${operation}\n${error instanceof Error ? error.message : 'Operation failed.'}`); } };
  return <section className="system-panel" aria-label="Development file and system tools">
    <div className="memory-heading"><div><p className="panel-label">Development only</p><h2>File and system tools</h2></div><span>Permission-gated</span></div>
    <div className="system-form"><input value={path} onChange={(event) => setPath(event.target.value)} placeholder="Absolute file or directory path" aria-label="File path" /><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Destination path" aria-label="Destination path" /><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="New text-file content" aria-label="New file content" /></div>
    <div className="voice-actions"><button type="button" onClick={() => void bridge.setDevelopmentSession(true)}>Set mock verified session</button><button type="button" onClick={() => void bridge.setDevelopmentSession(false)}>Clear mock session</button><button type="button" onClick={() => void run('FILE_READ', () => bridge.read(path))}>Read</button><button type="button" onClick={() => void run('FILE_DISPLAY', () => bridge.display(path))}>Display</button><button type="button" onClick={() => void run('FILE_CREATE', () => bridge.create({ path, content }))}>Create</button><button type="button" onClick={() => void run('FILE_RENAME', () => bridge.rename({ source: path, destination }))}>Rename</button><button type="button" onClick={() => void run('FILE_MOVE', () => bridge.move({ source: path, destination }))}>Move</button><button type="button" onClick={() => void run('FILE_DELETE', () => bridge.delete({ path }))}>Delete request</button><button type="button" onClick={() => void run('FILE_DELETE confirmed', () => bridge.delete({ path, confirmed: true }))}>Confirm trash</button><button type="button" onClick={() => void run('FILE_SEARCH', () => bridge.search({ root: path, limit: 20 }))}>Search</button><button type="button" onClick={() => void run('SYSTEM_DIAGNOSTICS', () => bridge.diagnostics())}>Diagnostics</button></div>
    <pre className="system-output" aria-live="polite">{output || 'Every result reports capability, scope, authorization, and confirmation metadata.'}</pre>
  </section>;
}