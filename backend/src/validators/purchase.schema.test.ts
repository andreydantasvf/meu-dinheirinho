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
      const result = createPurchaseSchema.safeParse({
        ...base,
        valorTotal: 100.555,
      });

      expect(result.success).toBe(false);
    });

    it('accepts valorTotal with exactly 2 decimal places', () => {
      const result = createPurchaseSchema.safeParse({
        ...base,
        valorTotal: 100.55,
      });

      expect(result.success).toBe(true);
    });

    it('defaults terceiro to null when omitted', () => {
      const result = createPurchaseSchema.parse({ ...base, valorTotal: 10 });

      expect(result.terceiro).toBeNull();
    });

    it('trims terceiro and turns a blank one into null', () => {
      const comNome = createPurchaseSchema.parse({
        ...base,
        valorTotal: 10,
        terceiro: '  Maria  ',
      });
      const vazio = createPurchaseSchema.parse({
        ...base,
        valorTotal: 10,
        terceiro: '   ',
      });

      expect(comNome.terceiro).toBe('Maria');
      expect(vazio.terceiro).toBeNull();
    });

    it('rejects terceiro longer than 60 characters', () => {
      const result = createPurchaseSchema.safeParse({
        ...base,
        valorTotal: 10,
        terceiro: 'a'.repeat(61),
      });

      expect(result.success).toBe(false);
    });
  });
});
