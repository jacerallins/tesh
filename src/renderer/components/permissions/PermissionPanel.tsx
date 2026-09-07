import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Capability, PermissionDuration, PermissionGrant, PermissionType } from '../../../shared/permissionTypes';

const permissionValues: readonly PermissionType[] = ['READ', 'WRITE', 'EXECUTE', 'DELETE', 'COMMUNICATE', 'LOCATION', 'MICROPHONE', 'CAMERA', 'SYSTEM_DIAGNOSTICS', 'DEVICE_ACCESS', 'NETWORK', 'MEMORY_ACCESS'];
const durations: readonly PermissionDuration[] = ['ONCE', 'SESSION', 'UNTIL_REVOKED'];

export function PermissionPanel(): ReactElement | null {
  const permissionBridge = window.tesh?.permissions;
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [permissions, setPermissions] = useState<PermissionGrant[]>([]);
  const [permission, setPermission] = useState<PermissionType>('MEMORY_ACCESS');
  const [scope, setScope] = useState('');
  const [duration, setDuration] = useState<PermissionDuration>('SESSION');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!permissionBridge) return;
    void Promise.all([permissionBridge.listCapabilities(), permissionBridge.listPermissions()]).then(([nextCapabilities, nextPermissions]) => { setCapabilities(nextCapabilities); setPermissions(nextPermissions); });
  }, [permissionBridge]);

  if (!permissionBridge) return <section className="permission-panel preview-panel" aria-label="Permission dashboard preview"><div className="memory-heading"><div><p className="panel-label">Development preview</p><h2>Trust dashboard</h2></div><span>Electron IPC required</span></div><p className="preview-copy">Permission controls are available in the Electron development window. This browser preview cannot access SQLite or grant permissions.</p><div className="capability-list"><p className="panel-label">Permission types</p>{permissionValues.map((item) => <div className="capability-item" key={item}><strong>{item}</strong><span>UNKNOWN by default</span></div>)}</div></section>;
  const refresh = async (): Promise<void> => setPermissions(await permissionBridge.listPermissions());
  const grant = async (): Promise<void> => { await permissionBridge.grant(permission, scope.trim() || undefined, duration); setMessage('Permission granted.'); await refresh(); };
  const deny = async (): Promise<void> => { await permissionBridge.deny(permission, scope.trim() || undefined); setMessage('Permission denied.'); await refresh(); };
  const revoke = async (id: string): Promise<void> => { await permissionBridge.revoke(id); setMessage('Permission revoked.'); await refresh(); };

  return <section className="permission-panel" aria-label="Development permission dashboard">
    <div className="memory-heading"><div><p className="panel-label">Development only</p><h2>Trust dashboard</h2></div><span>{permissions.length} stored permissions</span></div>
    <div className="permission-form">
      <select value={permission} onChange={(event) => setPermission(event.target.value as PermissionType)} aria-label="Permission type">{permissionValues.map((item) => <option key={item}>{item}</option>)}</select>
      <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Resource scope, optional" aria-label="Permission scope" />
      <select value={duration} onChange={(event) => setDuration(event.target.value as PermissionDuration)} aria-label="Permission duration">{durations.map((item) => <option key={item}>{item}</option>)}</select>
      <button type="button" onClick={() => void grant()}>Grant</button><button type="button" onClick={() => void deny()}>Deny</button>
    </div>
    <div className="permission-list">{permissions.map((item) => <article className={`permission-item ${item.state.toLowerCase()}`} key={item.id}><strong>{item.permission} · {item.state}</strong><span>{item.scope || 'Global scope'} · {item.duration}{item.expiresAt ? ` · expires ${new Date(item.expiresAt).toLocaleString()}` : ''}</span><button type="button" onClick={() => void revoke(item.id)}>Revoke</button></article>)}</div>
    <div className="capability-list"><p className="panel-label">Registered capabilities</p>{capabilities.map((item) => <div className="capability-item" key={item.id}><strong>{item.name}</strong><span>{item.riskLevel} risk · {item.requiresConfirmation ? 'confirmation required' : 'no confirmation'} · {item.enabled ? 'enabled' : 'disabled'}</span></div>)}</div>
    <p className="memory-message" aria-live="polite">{message}</p>
  </section>;
}
