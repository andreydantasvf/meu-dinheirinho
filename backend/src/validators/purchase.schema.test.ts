import { describe, expect, it } from 'vitest';
import { createPurchaseSchema } from './purchase.schema';

describe('purchase.schema', () => {
  describe('createPurchaseSchema', () => {
    const base = {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      descricao: 'Compra teste',
      dataCompra: '2026-08-08',
      numeroParcelas: 1,
    };

    it('rejects valorTotal with more than 2 decimal places', () => {
      const result = createPurchaseSchema.safeParse({ ...base, valorTotal: 100.555 });

      expect(result.success).toBe(false);
    });

    it('accepts valorTotal with exactly 2 decimal places', () => {
      const result = createPurchaseSchema.safeParse({ ...base, valorTotal: 100.55 });

      expect(result.success).toBe(true);
    });
  });
});
