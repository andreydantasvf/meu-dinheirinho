import { z } from 'zod';

export const createTransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  valor: z.coerce.number().positive(),
  descricao: z.string().min(1, 'descricao é obrigatória'),
  data: z.coerce.date(),
  tipo: z.enum(['RECEITA', 'DESPESA']),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
