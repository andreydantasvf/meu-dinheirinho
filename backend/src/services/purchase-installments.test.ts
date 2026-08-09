import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { generateInstallments } from './purchase-installments';

describe('generateInstallments', () => {
  it('splits the total across installments, adjusting the last one for rounding', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(100),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 2, 15)), // 15/03/2026
    });

    expect(installments).toHaveLength(3);
    expect(installments[0].valor.toString()).toBe('33.33');
    expect(installments[1].valor.toString()).toBe('33.33');
    expect(installments[2].valor.toString()).toBe('33.34');

    const soma = installments.reduce((acc, i) => acc.plus(i.valor), new Prisma.Decimal(0));
    expect(soma.toString()).toBe('100');
  });

  it('sets parcelaNumero and parcelaTotal sequentially', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(300),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 2, 15)),
    });

    expect(installments.map((i) => i.parcelaNumero)).toEqual([1, 2, 3]);
    expect(installments.every((i) => i.parcelaTotal === 3)).toBe(true);
  });

  it('repeats the purchase day-of-month for each installment date', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(300),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 2, 15)), // 15/03/2026
    });

    expect(installments.map((i) => i.data.toISOString().slice(0, 10))).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
    ]);
  });

  it('clamps the day to the last valid day of shorter months', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(300),
      numeroParcelas: 3,
      dataCompra: new Date(Date.UTC(2026, 0, 31)), // 31/01/2026
    });

    expect(installments.map((i) => i.data.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('returns a single installment with the full amount when numeroParcelas is 1', () => {
    const installments = generateInstallments({
      valorTotal: new Prisma.Decimal(150.5),
      numeroParcelas: 1,
      dataCompra: new Date(Date.UTC(2026, 5, 1)),
    });

    expect(installments).toHaveLength(1);
    expect(installments[0].valor.toString()).toBe('150.5');
  });
});
