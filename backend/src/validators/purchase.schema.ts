import { z } from 'zod';

export const createPurchaseSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  valorTotal: z.coerce.number().positive().multipleOf(0.01),
  descricao: z.string().min(1, 'descricao é obrigatória'),
  dataCompra: z.coerce.date(),
  numeroParcelas: z.coerce.number().int().min(1),
  // Nome de quem comprou: a compra entra na fatura do cartão, mas não no gasto.
  // O PUT é substituição completa, então omitido/vazio vira null (compra própria).
  terceiro: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => v || null),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
