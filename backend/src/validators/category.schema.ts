import { z } from 'zod';

export const createCategorySchema = z.object({
  nome: z.string().min(1, 'nome é obrigatório'),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  icone: z.string().optional(),
  cor: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
