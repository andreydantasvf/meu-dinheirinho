import { describe, expect, it } from 'vitest';
import { dashboardQuerySchema, extratoQuerySchema } from './reports.schema';

describe('reports.schema', () => {
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

  describe('dashboardQuerySchema', () => {
    it('accepts a missing mes', () => {
      const result = dashboardQuerySchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it('accepts a valid YYYY-MM month', () => {
      const result = dashboardQuerySchema.safeParse({ mes: '2026-08' });

      expect(result.success).toBe(true);
    });

    it('rejects an invalid month format', () => {
      const result = dashboardQuerySchema.safeParse({ mes: '2026-13' });

      expect(result.success).toBe(false);
    });
  });
});
