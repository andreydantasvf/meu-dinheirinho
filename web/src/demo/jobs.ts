import { ensureHorizon } from './handlers/fixed-expenses';
import { advanceDueReminders } from './handlers/reminders';
import type { DemoDb } from './types';

// No backend esses jobs rodam no startup e por cron; na demo, a cada carregamento do app —
// assim quem volta semanas depois ainda vê transações futuras e lembretes em dia.
export function runStartupJobs(db: DemoDb, agora: Date): void {
  ensureHorizon(db, agora);
  advanceDueReminders(db, agora);
}
