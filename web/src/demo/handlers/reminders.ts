import type { Reminder } from '@/types/entities';
import { DemoHttpError, invalid } from '../errors';
import { calcularProximoDisparo } from '../logic/reminder-schedule';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import {
  definedOnly,
  findOr404,
  newId,
  nowIso,
  oneOf,
  optionalField,
  parseDate,
  parseIntInRange,
  parseMoney,
  requireString,
} from './shared';

// Espelha backend/src/{services/reminder.service,validators/reminder.schema}.ts.

// Default de REMINDERS_TZ no backend.
const TZ = 'America/Sao_Paulo';
const NOT_FOUND = 'Lembrete não encontrado';
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

type ScheduleFields = Pick<
  Reminder,
  'recorrencia' | 'diaDoMes' | 'dataUnica' | 'horario' | 'diasAntecedencia'
>;

function proximoDisparo(fields: ScheduleFields, agora: Date): string | null {
  const disparo = calcularProximoDisparo(
    {
      ...fields,
      dataUnica: fields.dataUnica ? new Date(fields.dataUnica) : null,
    },
    agora,
    TZ,
  );
  return disparo ? disparo.toISOString() : null;
}

function mensagemErroRecorrencia(data: {
  recorrencia?: string;
  diaDoMes?: number | null;
  dataUnica?: string | null;
}): string | null {
  if (data.recorrencia === 'MENSAL' && !data.diaDoMes) {
    return 'diaDoMes é obrigatório para lembretes mensais';
  }
  if (data.recorrencia === 'UNICO' && !data.dataUnica) {
    return 'dataUnica é obrigatória para lembretes únicos';
  }
  return null;
}

function parseReminderFields(body: Record<string, unknown>) {
  return definedOnly({
    titulo: optionalField(body, 'titulo', requireString),
    tipo: optionalField(body, 'tipo', (v) =>
      oneOf(v, ['ENTRADA', 'SAIDA'] as const),
    ),
    valor: optionalField(body, 'valor', (v) =>
      v === null ? null : parseMoney(v),
    ),
    recorrencia: optionalField(body, 'recorrencia', (v) =>
      oneOf(v, ['MENSAL', 'UNICO'] as const),
    ),
    diaDoMes: optionalField(body, 'diaDoMes', (v) =>
      v === null ? null : parseIntInRange(v, 1, 31),
    ),
    dataUnica: optionalField(body, 'dataUnica', (v) =>
      v === null ? null : parseDate(v),
    ),
    horario: optionalField(body, 'horario', (v) => {
      if (typeof v !== 'string' || !HORARIO.test(v)) throw invalid();
      return v;
    }),
    diasAntecedencia: optionalField(body, 'diasAntecedencia', (v) =>
      parseIntInRange(v, 0, 7),
    ),
    ativo: optionalField(body, 'ativo', (v) => {
      if (typeof v !== 'boolean') throw invalid();
      return v;
    }),
    fixedExpenseId: optionalField(body, 'fixedExpenseId', (v) =>
      v === null ? null : requireString(v),
    ),
  });
}

export function createReminder(
  db: DemoDb,
  body: Record<string, unknown>,
  agora = new Date(),
): Reminder {
  const data = parseReminderFields(body);
  if (!data.titulo || !data.tipo || !data.recorrencia) throw invalid();
  // No create a regra é um superRefine do Zod → 400 "Dados inválidos".
  if (mensagemErroRecorrencia(data)) throw invalid();

  const fields: ScheduleFields = {
    recorrencia: data.recorrencia,
    diaDoMes: data.recorrencia === 'MENSAL' ? (data.diaDoMes ?? null) : null,
    dataUnica: data.recorrencia === 'UNICO' ? (data.dataUnica ?? null) : null,
    horario: data.horario ?? '09:00',
    diasAntecedencia: data.diasAntecedencia ?? 0,
  };
  const now = nowIso();
  const reminder: Reminder = {
    id: newId(),
    titulo: data.titulo,
    tipo: data.tipo,
    valor: data.valor ?? null,
    ...fields,
    ativo: data.ativo ?? true,
    proximoDisparo: proximoDisparo(fields, agora),
    ultimoDisparo: null,
    fixedExpenseId: data.fixedExpenseId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.reminders.push(reminder);
  return reminder;
}

function updateReminder(
  db: DemoDb,
  id: string,
  body: Record<string, unknown>,
): Reminder {
  const data = parseReminderFields(body);
  const atual = findOr404(db.reminders, id, NOT_FOUND);
  const merged = { ...atual, ...data };
  // No update a regra roda sobre o registro mesclado → AppError 400 com a mensagem.
  const erro = mensagemErroRecorrencia(merged);
  if (erro) throw new DemoHttpError(400, erro);

  const fields: ScheduleFields = {
    recorrencia: merged.recorrencia,
    diaDoMes: merged.recorrencia === 'MENSAL' ? merged.diaDoMes : null,
    dataUnica: merged.recorrencia === 'UNICO' ? merged.dataUnica : null,
    horario: merged.horario,
    diasAntecedencia: merged.diasAntecedencia,
  };
  // Recalcula sempre a partir de agora: reativar um lembrete não dispara os perdidos.
  Object.assign(atual, data, fields, {
    proximoDisparo: proximoDisparo(fields, new Date()),
    updatedAt: nowIso(),
  });
  return atual;
}

function removeReminder(db: DemoDb, id: string): void {
  findOr404(db.reminders, id, NOT_FOUND);
  db.reminders = db.reminders.filter((r) => r.id !== id);
}

// orderBy [{ ativo: 'desc' }, { proximoDisparo: 'asc' }] — SQLite põe NULL primeiro em ASC.
function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    if (a.proximoDisparo === b.proximoDisparo) return 0;
    if (a.proximoDisparo === null) return -1;
    if (b.proximoDisparo === null) return 1;
    return a.proximoDisparo.localeCompare(b.proximoDisparo);
  });
}

// O que reminderService.dispatchDue faz, menos o envio: na demo nenhum canal existe.
export function advanceDueReminders(db: DemoDb, agora: Date): void {
  for (const reminder of db.reminders) {
    if (!reminder.ativo || reminder.proximoDisparo === null) continue;
    if (new Date(reminder.proximoDisparo) > agora) continue;
    reminder.ultimoDisparo = agora.toISOString();
    reminder.proximoDisparo = proximoDisparo(reminder, agora);
  }
}

export const reminderRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/reminders',
    handler: ({ db }) => sortReminders(db.reminders),
  },
  {
    method: 'GET',
    pattern: '/reminders/:id',
    handler: ({ db, params }) => findOr404(db.reminders, params.id, NOT_FOUND),
  },
  {
    method: 'POST',
    pattern: '/reminders',
    handler: ({ db, body }) => createReminder(db, body),
  },
  {
    method: 'PUT',
    pattern: '/reminders/:id',
    handler: ({ db, params, body }) => updateReminder(db, params.id, body),
  },
  {
    method: 'DELETE',
    pattern: '/reminders/:id',
    handler: ({ db, params }) => removeReminder(db, params.id),
  },
  {
    // Mesmo retorno do backend sem DISCORD_WEBHOOK_URL nem VAPID configurados.
    method: 'POST',
    pattern: '/reminders/:id/test',
    handler: ({ db, params }) => {
      findOr404(db.reminders, params.id, NOT_FOUND);
      return {
        canais: [
          { canal: 'discord', status: 'desativado' },
          { canal: 'web-push', status: 'desativado' },
        ],
      };
    },
  },
];
