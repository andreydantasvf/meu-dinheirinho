import { env } from '../config/env';
import type { Reminder } from '../generated/prisma/client.js';
import { discordNotifier } from '../notifications/discord.notifier';
import {
  montarMensagem,
  type NotificationMessage,
} from '../notifications/reminder-message';
import { webPushNotifier } from '../notifications/web-push.notifier';
import { reminderRepository } from '../repositories/reminder.repository';
import { AppError } from '../types/errors';
import {
  mensagemErroRecorrencia,
  type CreateReminderInput,
  type UpdateReminderInput,
} from '../validators/reminder.schema';
import { calcularProximoDisparo } from './reminder-schedule';

const notifiers = [discordNotifier, webPushNotifier];

export type ResultadoCanal = {
  canal: string;
  status: 'enviado' | 'falhou' | 'desativado';
  erro?: string;
};

type ScheduleFields = Pick<
  Reminder,
  'recorrencia' | 'diaDoMes' | 'dataUnica' | 'horario' | 'diasAntecedencia'
>;

function proximoDisparo(fields: ScheduleFields, agora: Date) {
  return calcularProximoDisparo(fields, agora, env.REMINDERS_TZ);
}

// Um canal com erro não impede os outros nem trava o lembrete — só é logado.
async function enviar(message: NotificationMessage): Promise<ResultadoCanal[]> {
  return Promise.all(
    notifiers.map(async (notifier): Promise<ResultadoCanal> => {
      if (!notifier.isEnabled()) {
        return { canal: notifier.name, status: 'desativado' };
      }
      try {
        await notifier.send(message);
        return { canal: notifier.name, status: 'enviado' };
      } catch (error) {
        console.error(`[Lembretes] Falha no canal ${notifier.name}:`, error);
        return {
          canal: notifier.name,
          status: 'falhou',
          erro: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

export const reminderService = {
  list() {
    return reminderRepository.findAll();
  },

  async get(id: string) {
    const reminder = await reminderRepository.findById(id);
    if (!reminder) throw new AppError('Lembrete não encontrado', 404);
    return reminder;
  },

  create(data: CreateReminderInput, agora = new Date()) {
    const fields: ScheduleFields = {
      recorrencia: data.recorrencia,
      diaDoMes: data.recorrencia === 'MENSAL' ? (data.diaDoMes ?? null) : null,
      dataUnica: data.recorrencia === 'UNICO' ? (data.dataUnica ?? null) : null,
      horario: data.horario ?? '09:00',
      diasAntecedencia: data.diasAntecedencia ?? 0,
    };
    return reminderRepository.create({
      ...data,
      ...fields,
      proximoDisparo: proximoDisparo(fields, agora),
    });
  },

  async update(id: string, data: UpdateReminderInput, agora = new Date()) {
    const atual = await this.get(id);
    const merged = { ...atual, ...data };
    const erro = mensagemErroRecorrencia(merged);
    if (erro) throw new AppError(erro, 400);

    const fields: ScheduleFields = {
      recorrencia: merged.recorrencia,
      diaDoMes: merged.recorrencia === 'MENSAL' ? merged.diaDoMes : null,
      dataUnica: merged.recorrencia === 'UNICO' ? merged.dataUnica : null,
      horario: merged.horario,
      diasAntecedencia: merged.diasAntecedencia,
    };
    // Recalcula sempre a partir de agora: reativar um lembrete não dispara os perdidos.
    return reminderRepository.update(id, {
      ...data,
      ...fields,
      proximoDisparo: proximoDisparo(fields, agora),
    });
  },

  async remove(id: string) {
    await this.get(id);
    return reminderRepository.remove(id);
  },

  // Dispara agora, sem mexer no agendamento — serve para validar os canais.
  async test(id: string) {
    const reminder = await this.get(id);
    const agora = new Date();
    const message = montarMensagem(
      reminder,
      reminder.proximoDisparo ?? agora,
      agora,
      env.REMINDERS_TZ,
    );
    return enviar(message);
  },

  async dispatchDue(agora = new Date()) {
    const due = await reminderRepository.findDue(agora);
    for (const reminder of due) {
      const message = montarMensagem(
        reminder,
        reminder.proximoDisparo ?? agora,
        agora,
        env.REMINDERS_TZ,
      );
      await enviar(message);
      // Mesmo que o servidor tenha ficado fora do ar e vários disparos tenham passado,
      // manda uma única notificação e pula direto para a próxima ocorrência futura.
      await reminderRepository.markDispatched(
        reminder.id,
        agora,
        proximoDisparo(reminder, agora),
      );
    }
    return due.length;
  },
};
