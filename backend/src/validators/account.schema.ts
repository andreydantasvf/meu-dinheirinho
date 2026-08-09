import { z } from 'zod';

const baseAccountSchema = z.object({
  nome: z.string().min(1, 'nome é obrigatório'),
  tipo: z.enum(['CONTA_CORRENTE', 'DINHEIRO', 'CARTAO_CREDITO']),
  limite: z.coerce.number().positive().optional(),
  diaFechamento: z.coerce.number().int().min(1).max(31).optional(),
  diaVencimento: z.coerce.number().int().min(1).max(31).optional(),
});

export const createAccountSchema = baseAccountSchema.refine(
  (data) =>
    data.tipo !== 'CARTAO_CREDITO' ||
    (data.limite !== undefined && data.diaFechamento !== undefined && data.diaVencimento !== undefined),
  {
    message: 'limite, diaFechamento e diaVencimento são obrigatórios para contas do tipo CARTAO_CREDITO',
    path: ['tipo'],
  },
);

export const updateAccountSchema = baseAccountSchema.partial().refine(
  (data) =>
    data.tipo !== 'CARTAO_CREDITO' ||
    (data.limite !== undefined && data.diaFechamento !== undefined && data.diaVencimento !== undefined),
  {
    message: 'limite, diaFechamento e diaVencimento são obrigatórios para contas do tipo CARTAO_CREDITO',
    path: ['tipo'],
  },
);

export type CreateAccountInput = z.infer<typeof baseAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
