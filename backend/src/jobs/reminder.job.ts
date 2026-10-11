import cron from 'node-cron';
import { reminderService } from '../services/reminder.service';

async function dispatch(origem: string) {
  try {
    const count = await reminderService.dispatchDue();
    if (count > 0)
      console.log(`[${origem}] ${count} lembrete(s) disparado(s).`);
  } catch (error) {
    console.error(`[${origem}] Erro ao disparar lembretes:`, error);
  }
}

export function startReminderJob() {
  // A cada 5 minutos — lembretes são agendados com granularidade de minuto.
  cron.schedule('*/5 * * * *', () => dispatch('Cron'));

  // Também roda no startup para pegar disparos perdidos enquanto o servidor estava fora.
  setTimeout(() => dispatch('Startup'), 1000);
}
