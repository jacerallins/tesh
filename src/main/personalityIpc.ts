import { ipcMain } from 'electron';
import type { PersonalityProfile } from '../shared/personalityTypes';
import type { PersonalityService } from './personalityService';
const keys: Array<keyof PersonalityProfile> = ['formality','warmth','humor','expressiveness','verbosity','proactive'];
export function registerPersonalityIpc(service: PersonalityService): void { ipcMain.handle('personality:get',()=>service.get()); ipcMain.handle('personality:update',(_event,value:unknown)=>{ if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Personality input is invalid.'); const input=value as Record<string,unknown>; for(const key of keys) if(input[key]!==undefined && !['LOW','MEDIUM','HIGH'].includes(String(input[key]))) throw new Error('Personality level is invalid.'); return service.update(input as Partial<PersonalityProfile>); }); }
