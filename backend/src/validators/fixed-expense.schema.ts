import { z } from 'zod';

export const createFixedExpenseSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  valor: z.coerce.number().positive().multipleOf(0.01),
  descricao: z.string().min(1, 'descricao é obrigatória'),
  dataInicio: z.coerce.date(),
});

export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>;
