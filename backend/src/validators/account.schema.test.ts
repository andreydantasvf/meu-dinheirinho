import { describe, expect, it } from 'vitest';
import { createAccountSchema } from './account.schema';

describe('account.schema', () => {
  describe('createAccountSchema', () => {
    it('rejects CARTAO_CREDITO without required fields', () => {
      const result = createAccountSchema.safeParse({
        nome: 'Nubank',
        tipo: 'CARTAO_CREDITO',
      });

      expect(result.success).toBe(false);
    });

    it('accepts CARTAO_CREDITO with all required fields', () => {
      const result = createAccountSchema.safeParse({
        nome: 'Nubank',
        tipo: 'CARTAO_CREDITO',
        limite: 5000,
        diaFechamento: 10,
        diaVencimento: 17,
      });

      expect(result.success).toBe(true);
    });

    it('accepts DINHEIRO without cartão-only fields', () => {
      const result = createAccountSchema.safeParse({
        nome: 'Carteira',
        tipo: 'DINHEIRO',
      });

      expect(result.success).toBe(true);
    });

    it('accepts CONTA_CORRENTE without cartão-only fields', () => {
      const result = createAccountSchema.safeParse({
        nome: 'Itaú',
        tipo: 'CONTA_CORRENTE',
      });

      expect(result.success).toBe(true);
    });
  });
});
