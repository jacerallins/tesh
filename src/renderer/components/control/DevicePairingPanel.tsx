import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
export function DevicePairingPanel(): ReactElement {
  const [code, setCode] = useState(''); const [expiresAt, setExpiresAt] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { if (!expiresAt) return; const timer = window.setInterval(() => { if (Date.parse(expiresAt) <= Date.now()) { setCode(''); setExpiresAt(''); setMessage('Pairing code expired.'); } }, 1000); return () => window.clearInterval(timer); }, [expiresAt]);
  const create = async (): Promise<void> => { try { const challenge = await window.tesh?.companion?.createPairingChallenge(); if (!challenge) throw new Error('Companion controls are unavailable.'); setCode(challenge.code); setExpiresAt(challenge.expiresAt); setMessage('Enter this code in the Tesh iPhone companion.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Pairing could not start.'); } };
  return <article className="capability-status" aria-label="Pair a Tesh device"><strong>Pair a device</strong><span>{code ? `PAIRING CODE ${code}` : 'No active code'}</span>{expiresAt ? <span>Expires {new Date(expiresAt).toLocaleTimeString()}</span> : null}<p>{message || 'Create a short-lived code. New devices receive status-only access until additional permissions are granted.'}</p><button type="button" onClick={() => void create()}>Create pairing code</button></article>;
}
