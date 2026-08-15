import { describe, expect, it } from 'vitest';
import { createCategorySchema, updateCategorySchema } from './category.schema';

describe('category.schema', () => {
  describe('createCategorySchema', () => {
    it('accepts a DESPESA category with a positive metaMensal', () => {
      const result = createCategorySchema.safeParse({
        nome: 'Lazer com minha namorada',
        tipo: 'DESPESA',
        metaMensal: 300,
      });

      expect(result.success).toBe(true);
    });

    it('rejects metaMensal of 0', () => {
      const result = createCategorySchema.safeParse({
        nome: 'Lazer',
        tipo: 'DESPESA',
        metaMensal: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects a negative metaMensal', () => {
      const result = createCategorySchema.safeParse({
        nome: 'Lazer',
        tipo: 'DESPESA',
        metaMensal: -50,
      });

      expect(result.success).toBe(false);
    });

    it('accepts a category with metaMensal omitted', () => {
      const result = createCategorySchema.safeParse({
        nome: 'Mercado',
        tipo: 'DESPESA',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateCategorySchema', () => {
    it('accepts metaMensal: null to clear an existing goal', () => {
      const result = updateCategorySchema.safeParse({
        metaMensal: null,
      });

      expect(result.success).toBe(true);
    });

    it('accepts a partial update that does not touch metaMensal', () => {
      const result = updateCategorySchema.safeParse({
        nome: 'Novo nome',
      });

      expect(result.success).toBe(true);
    });
  });
});
