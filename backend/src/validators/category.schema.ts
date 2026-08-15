import { z } from 'zod';

const metaMensalField = z
  .union([z.coerce.number().positive(), z.null()])
  .optional();

export const createCategorySchema = z.object({
  nome: z.string().min(1, 'nome é obrigatório'),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  icone: z.string().optional(),
  cor: z.string().optional(),
  metaMensal: metaMensalField,
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
