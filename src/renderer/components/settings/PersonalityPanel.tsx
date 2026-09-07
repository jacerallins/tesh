import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { PersonalityProfile } from '../../../shared/personalityTypes';

const fields: Array<keyof PersonalityProfile> = ['formality','warmth','humor','expressiveness','verbosity','proactive'];
const labels: Record<keyof PersonalityProfile,string> = { formality:'Formality', warmth:'Warmth', humor:'Humor', expressiveness:'Emotional expressiveness', verbosity:'Response length', proactive:'Proactive behavior' };
export function PersonalityPanel(): ReactElement {
  const [profile,setProfile]=useState<PersonalityProfile>(); const [saved,setSaved]=useState(false);
  useEffect(()=>{void window.tesh?.personality.get().then(setProfile);},[]);
  const update=(field:keyof PersonalityProfile,value:string):void=>{setProfile(current=>current?{...current,[field]:value as PersonalityProfile[typeof field]}:current);setSaved(false);};
  const save=async():Promise<void>=>{if(!profile)return;setProfile(await window.tesh.personality.update(profile));setSaved(true);};
  return <section className="settings-panel" aria-label="Tesh personality"><div className="settings-content"><p className="panel-label">PERSONALITY</p><h2>How Tesh behaves</h2><p className="settings-lead">These preferences shape Tesh's tone without changing its security rules or permissions.</p>{profile?fields.map(field=><label className="permission-item" key={field}><strong>{labels[field]}</strong><select value={profile[field]} onChange={event=>update(field,event.target.value)}>{['LOW','MEDIUM','HIGH'].map(value=><option key={value}>{value}</option>)}</select></label>):<p className="settings-lead">Loading personality…</p>}<button type="button" onClick={()=>void save()} disabled={!profile}>{saved?'Saved':'Save personality'}</button></div></section>;
}
