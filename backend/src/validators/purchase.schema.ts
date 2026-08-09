import { z } from 'zod';

export const createPurchaseSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  valorTotal: z.coerce.number().positive().multipleOf(0.01),
  descricao: z.string().min(1, 'descricao é obrigatória'),
  dataCompra: z.coerce.date(),
  numeroParcelas: z.coerce.number().int().min(1),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
