import type Database from 'better-sqlite3';
import type { PersonalityBridge, PersonalityLevel, PersonalityProfile } from '../shared/personalityTypes';

const defaults: PersonalityProfile = { formality: 'MEDIUM', warmth: 'HIGH', humor: 'MEDIUM', expressiveness: 'HIGH', verbosity: 'MEDIUM', proactive: 'MEDIUM' };
const levels: PersonalityLevel[] = ['LOW','MEDIUM','HIGH'];
export class PersonalityService implements PersonalityBridge {
  constructor(private readonly db: Database.Database) { this.db.exec('CREATE TABLE IF NOT EXISTS tesh_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)'); }
  async get(): Promise<PersonalityProfile> { const row = this.db.prepare('SELECT value FROM tesh_preferences WHERE key=?').get('personality') as {value?:string}|undefined; if (!row?.value) return {...defaults}; try { return {...defaults, ...(JSON.parse(row.value) as Partial<PersonalityProfile>)}; } catch { return {...defaults}; } }
  async update(input: Partial<PersonalityProfile>): Promise<PersonalityProfile> { const current=await this.get(); const next={...current}; for(const key of Object.keys(defaults) as Array<keyof PersonalityProfile>){const value=input[key]; if(value!==undefined){if(!levels.includes(value)) throw new Error(`Invalid personality value for ${key}.`); next[key]=value;}} this.db.prepare('INSERT OR REPLACE INTO tesh_preferences (key,value,updated_at) VALUES (?,?,?)').run('personality',JSON.stringify(next),new Date().toISOString()); return next; }
}
