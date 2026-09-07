import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Routine } from '../../../shared/routineTypes';
export function RoutinesPanel(): ReactElement {
  const [routines,setRoutines]=useState<Routine[]>([]); const [message,setMessage]=useState('');
  const refresh=async():Promise<void>=>setRoutines(await window.tesh?.routines.list() ?? []);
  useEffect(()=>{void refresh();},[]);
  const toggle=async(routine:Routine):Promise<void>=>{await window.tesh?.routines.update(routine.id,{enabled:!routine.enabled});await refresh();};
  const run=async(id:string):Promise<void>=>{const result=await window.tesh?.routines.run(id,false);setMessage(result?.message ?? 'Unavailable');};
  return <section className="routines-panel" aria-label="Tesh routines"><div className="control-center-header"><div><span className="panel-label">AUTOMATION</span><h2>Routines</h2><p className="settings-lead">Create controlled routines for repeatable actions.</p></div><button type="button" onClick={()=>void refresh()}>Refresh</button></div>{routines.length ? routines.map(routine=><article className="capability-status" key={routine.id}><strong>{routine.name}</strong><span>{routine.enabled?'ENABLED':'DISABLED'} · {routine.trigger.type} · {routine.trigger.value}</span><p>{routine.actions.map(action=>action.type).join(' → ')}</p><div className="voice-actions"><button type="button" onClick={()=>void toggle(routine)}>{routine.enabled?'Disable':'Enable'}</button><button type="button" disabled={!routine.enabled} onClick={()=>void run(routine.id)}>Run now</button></div></article>) : <p className="settings-lead">No routines configured.</p>}<p className="memory-message">{message}</p></section>;
}
