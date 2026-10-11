import { describe, expect, it } from 'vitest';
import { createReminderSchema, updateReminderSchema } from './reminder.schema';

describe('reminder.schema', () => {
  describe('createReminderSchema', () => {
    it('accepts a monthly ENTRADA reminder without valor', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'Freela da Nara',
        tipo: 'ENTRADA',
        recorrencia: 'MENSAL',
        diaDoMes: 25,
      });

      expect(result.success).toBe(true);
    });

    it('accepts a one-off SAIDA reminder with valor, horario and antecedencia', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'IPVA',
        tipo: 'SAIDA',
        valor: '1200.50',
        recorrencia: 'UNICO',
        dataUnica: '2027-01-15',
        horario: '08:30',
        diasAntecedencia: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.dataUnica).toBeInstanceOf(Date);
    });

    it('rejects a monthly reminder without diaDoMes', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'Geladeira',
        tipo: 'SAIDA',
        recorrencia: 'MENSAL',
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(['diaDoMes']);
    });

    it('rejects a one-off reminder without dataUnica', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'IPVA',
        tipo: 'SAIDA',
        recorrencia: 'UNICO',
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(['dataUnica']);
    });

    it('rejects diaDoMes outside 1–31', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'Aluguel',
        tipo: 'SAIDA',
        recorrencia: 'MENSAL',
        diaDoMes: 32,
      });

      expect(result.success).toBe(false);
    });

    it('rejects an invalid horario', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'Aluguel',
        tipo: 'SAIDA',
        recorrencia: 'MENSAL',
        diaDoMes: 10,
        horario: '24:00',
      });

      expect(result.success).toBe(false);
    });

    it('rejects diasAntecedencia above 7', () => {
      const result = createReminderSchema.safeParse({
        titulo: 'Aluguel',
        tipo: 'SAIDA',
        recorrencia: 'MENSAL',
        diaDoMes: 10,
        diasAntecedencia: 8,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateReminderSchema', () => {
    it('accepts a partial patch toggling ativo', () => {
      const result = updateReminderSchema.safeParse({ ativo: false });

      expect(result.success).toBe(true);
    });
  });
});
