import { z } from 'zod';

export const loginSchema = z.object({
  password: z.string().min(1, 'senha é obrigatória'),
});

export type LoginInput = z.infer<typeof loginSchema>;
