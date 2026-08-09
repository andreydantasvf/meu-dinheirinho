import { describe, expect, it } from 'vitest';
import { createTransactionSchema } from './transaction.schema';

describe('transaction.schema', () => {
  describe('createTransactionSchema', () => {
    const base = {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      descricao: 'Transação teste',
      data: '2026-08-08',
      tipo: 'DESPESA' as const,
    };

    it('rejects valor with more than 2 decimal places', () => {
      const result = createTransactionSchema.safeParse({ ...base, valor: 100.555 });

      expect(result.success).toBe(false);
    });

    it('accepts valor with exactly 2 decimal places', () => {
      const result = createTransactionSchema.safeParse({ ...base, valor: 100.55 });

      expect(result.success).toBe(true);
    });
  });
});
