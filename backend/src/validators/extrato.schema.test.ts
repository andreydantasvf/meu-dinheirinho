import { describe, expect, it } from 'vitest';
import { extratoQuerySchema } from './extrato.schema';

describe('extrato.schema', () => {
  describe('extratoQuerySchema', () => {
    it('accepts a valid YYYY-MM month', () => {
      const result = extratoQuerySchema.safeParse({ mes: '2026-08' });

      expect(result.success).toBe(true);
    });

    it('rejects a month greater than 12', () => {
      const result = extratoQuerySchema.safeParse({ mes: '2026-13' });

      expect(result.success).toBe(false);
    });

    it('rejects a month of 00', () => {
      const result = extratoQuerySchema.safeParse({ mes: '2026-00' });

      expect(result.success).toBe(false);
    });

    it('rejects a missing mes', () => {
      const result = extratoQuerySchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});
