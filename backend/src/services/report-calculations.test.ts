import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import {
  agruparFaturaAtualPorCartao,
  agruparFaturasFuturas,
  agruparGastoPorCategoria,
  agruparTerceiros,
  calcularLimiteDisponivel,
  calcularSaldoMes,
  construirFiltroExtrato,
  currentMonthUTC,
  mesParaIntervalo,
  somarValores,
} from './report-calculations';

describe('calcularSaldoMes', () => {
  it('subtracts despesas from receitas', () => {
    const saldo = calcularSaldoMes([
      { tipo: 'RECEITA', valor: new Prisma.Decimal(1000) },
      { tipo: 'DESPESA', valor: new Prisma.Decimal(300) },
      { tipo: 'DESPESA', valor: new Prisma.Decimal(100) },
    ]);

    expect(saldo.toString()).toBe('600');
  });

  it('returns zero for an empty list', () => {
    expect(calcularSaldoMes([]).toString()).toBe('0');
  });
});

describe('agruparGastoPorCategoria', () => {
  it('sums valor per categoryId', () => {
    const grupos = agruparGastoPorCategoria([
      {
        valor: new Prisma.Decimal(50),
        categoryId: 'cat1',
        category: { nome: 'Mercado' },
      },
      {
        valor: new Prisma.Decimal(30),
        categoryId: 'cat1',
        category: { nome: 'Mercado' },
      },
      {
        valor: new Prisma.Decimal(20),
        categoryId: 'cat2',
        category: { nome: 'Transporte' },
      },
    ]);

    expect(grupos).toEqual([
      { categoriaId: 'cat1', nome: 'Mercado', total: new Prisma.Decimal(80) },
      {
        categoriaId: 'cat2',
        nome: 'Transporte',
        total: new Prisma.Decimal(20),
      },
    ]);
  });
});

describe('agruparFaturaAtualPorCartao', () => {
  it('sums valor per accountId', () => {
    const grupos = agruparFaturaAtualPorCartao([
      {
        valor: new Prisma.Decimal(100),
        accountId: 'acc1',
        account: { nome: 'Nubank' },
      },
      {
        valor: new Prisma.Decimal(50),
        accountId: 'acc1',
        account: { nome: 'Nubank' },
      },
    ]);

    expect(grupos).toEqual([
      { accountId: 'acc1', nome: 'Nubank', total: new Prisma.Decimal(150) },
    ]);
  });
});

describe('agruparTerceiros', () => {
  it('sums values per terceiro, ignores own purchases and sorts by name', () => {
    const result = agruparTerceiros([
      { valor: new Prisma.Decimal('50.10'), terceiro: 'Maria' },
      { valor: new Prisma.Decimal(300), terceiro: null },
      { valor: new Prisma.Decimal(80), terceiro: 'João' },
      { valor: new Prisma.Decimal('0.2'), terceiro: 'Maria' },
    ]);

    expect(result.map((r) => [r.nome, r.total.toString()])).toEqual([
      ['João', '80'],
      ['Maria', '50.3'],
    ]);
  });

  it('returns an empty list when there are no terceiros', () => {
    expect(
      agruparTerceiros([{ valor: new Prisma.Decimal(10), terceiro: null }]),
    ).toEqual([]);
  });
});

describe('mesParaIntervalo', () => {
  it('builds UTC bounds for a mid-year month', () => {
    const { inicio, fim } = mesParaIntervalo('2026-03');

    expect(inicio.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(fim.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('rolls over correctly from december to january', () => {
    const { inicio, fim } = mesParaIntervalo('2026-12');

    expect(inicio.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(fim.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('currentMonthUTC', () => {
  it('returns a YYYY-MM string', () => {
    expect(currentMonthUTC()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});

describe('construirFiltroExtrato', () => {
  it('builds a date range for the given month', () => {
    const where = construirFiltroExtrato({ mes: '2026-03' });

    expect((where.data as { gte: Date }).gte.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect((where.data as { lt: Date }).lt.toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    );
    expect(where).not.toHaveProperty('categoryId');
    expect(where).not.toHaveProperty('accountId');
  });

  it('includes categoriaId and accountId filters when provided', () => {
    const where = construirFiltroExtrato({
      mes: '2026-03',
      categoriaId: 'cat1',
      accountId: 'acc1',
    });

    expect(where.categoryId).toBe('cat1');
    expect(where.accountId).toBe('acc1');
  });
});

describe('agruparFaturasFuturas', () => {
  it('groups by year-month, sorted ascending', () => {
    const grupos = agruparFaturasFuturas([
      { valor: new Prisma.Decimal(100), data: new Date(Date.UTC(2026, 4, 10)) },
      { valor: new Prisma.Decimal(50), data: new Date(Date.UTC(2026, 3, 5)) },
      { valor: new Prisma.Decimal(25), data: new Date(Date.UTC(2026, 3, 20)) },
    ]);

    expect(grupos).toEqual([
      { mes: '2026-04', total: new Prisma.Decimal(75) },
      { mes: '2026-05', total: new Prisma.Decimal(100) },
    ]);
  });
});

describe('somarValores', () => {
  it('sums the valor field across all transactions', () => {
    const total = somarValores([
      { valor: new Prisma.Decimal(10) },
      { valor: new Prisma.Decimal(15) },
    ]);
    expect(total.toString()).toBe('25');
  });
});

describe('calcularLimiteDisponivel', () => {
  it('subtracts current and future invoices from the limit', () => {
    const disponivel = calcularLimiteDisponivel({
      limite: new Prisma.Decimal(5000),
      faturaAtual: new Prisma.Decimal(800),
      faturasFuturas: [
        { mes: '2026-09', total: new Prisma.Decimal(700) },
        { mes: '2026-10', total: new Prisma.Decimal(500) },
      ],
    });

    expect(disponivel.toString()).toBe('3000');
  });
});
