import type { Routine } from '../../shared/routineTypes';
import type { RoutineService } from './routineService';

export class RoutineScheduler {
  private timer?: NodeJS.Timeout;
  private lastRun = new Map<string, string>();
  constructor(private readonly service: RoutineService, private readonly intervalMs = 30_000) {}
  start(): void { if (this.timer) return; this.timer = setInterval(() => { void this.tick(); }, this.intervalMs); void this.tick(); }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  private async tick(): Promise<void> {
    const routines = await this.service.list(); const now = new Date(); const hhmm = now.toTimeString().slice(0,5); const day = now.toISOString().slice(0,10);
    for (const routine of routines) {
      if (!routine.enabled || routine.trigger.type !== 'SCHEDULE') continue;
      const value = routine.trigger.value.trim().toLowerCase(); let key: string | undefined;
      if (/^daily:\d{2}:\d{2}$/.test(value) && value.slice(6) === hhmm) key = `${routine.id}:${day}`;
      else if (/^every:\d+$/.test(value)) { const seconds = Number(value.slice(6)); if (seconds > 0 && Math.floor(Date.now() / 1000) % seconds < Math.ceil(this.intervalMs / 1000)) key = `${routine.id}:${Math.floor(Date.now() / (seconds * 1000))}`; }
      if (!key || this.lastRun.get(routine.id) === key) continue;
      const result = await this.service.run(routine.id, false); if (result.ok) this.lastRun.set(routine.id, key);
    }
  }
}
