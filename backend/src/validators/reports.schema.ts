import { z } from 'zod';

export const mesSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mes deve estar no formato YYYY-MM');

export const extratoQuerySchema = z.object({
  mes: mesSchema,
  categoriaId: z.string().optional(),
  accountId: z.string().optional(),
});

export type ExtratoQuery = z.infer<typeof extratoQuerySchema>;

export const dashboardQuerySchema = z.object({
  mes: mesSchema.optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
