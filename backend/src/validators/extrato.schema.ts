import { z } from 'zod';

export const extratoQuerySchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mes deve estar no formato YYYY-MM'),
  categoriaId: z.string().optional(),
  accountId: z.string().optional(),
});

export type ExtratoQuery = z.infer<typeof extratoQuerySchema>;
