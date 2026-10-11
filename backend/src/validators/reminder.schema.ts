import { z } from 'zod';

const reminderBaseSchema = z.object({
  titulo: z.string().min(1, 'titulo é obrigatório'),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  valor: z
    .union([z.coerce.number().positive().multipleOf(0.01), z.null()])
    .optional(),
  recorrencia: z.enum(['MENSAL', 'UNICO']),
  diaDoMes: z
    .union([z.coerce.number().int().min(1).max(31), z.null()])
    .optional(),
  dataUnica: z.union([z.coerce.date(), z.null()]).optional(),
  horario: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'horario deve estar no formato HH:mm')
    .optional(),
  diasAntecedencia: z.coerce.number().int().min(0).max(7).optional(),
  ativo: z.boolean().optional(),
  fixedExpenseId: z.union([z.string().min(1), z.null()]).optional(),
});

type RecorrenciaFields = {
  recorrencia?: 'MENSAL' | 'UNICO';
  diaDoMes?: number | null;
  dataUnica?: Date | null;
};

// Regra cruzada também usada pelo service no update (patch parcial + registro atual).
export function mensagemErroRecorrencia(
  data: RecorrenciaFields,
): string | null {
  if (data.recorrencia === 'MENSAL' && !data.diaDoMes) {
    return 'diaDoMes é obrigatório para lembretes mensais';
  }
  if (data.recorrencia === 'UNICO' && !data.dataUnica) {
    return 'dataUnica é obrigatória para lembretes únicos';
  }
  return null;
}

export const createReminderSchema = reminderBaseSchema.superRefine(
  (data, ctx) => {
    const message = mensagemErroRecorrencia(data);
    if (message) {
      ctx.addIssue({
        code: 'custom',
        message,
        path: [data.recorrencia === 'MENSAL' ? 'diaDoMes' : 'dataUnica'],
      });
    }
  },
);

export const updateReminderSchema = reminderBaseSchema.partial();

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
