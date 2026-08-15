import { Prisma } from '../generated/prisma';

export type TransactionForSaldo = { tipo: 'RECEITA' | 'DESPESA'; valor: Prisma.Decimal };

export function calcularSaldoMes(transactions: TransactionForSaldo[]): Prisma.Decimal {
  return transactions.reduce((saldo, t) => {
    return t.tipo === 'RECEITA' ? saldo.plus(t.valor) : saldo.minus(t.valor);
  }, new Prisma.Decimal(0));
}

export type TransactionComCategoria = {
  valor: Prisma.Decimal;
  categoryId: string;
  category: { nome: string };
};

export type GastoPorCategoria = { categoriaId: string; nome: string; total: Prisma.Decimal };

export function agruparGastoPorCategoria(transactions: TransactionComCategoria[]): GastoPorCategoria[] {
  const totals = new Map<string, GastoPorCategoria>();
  for (const t of transactions) {
    const existing = totals.get(t.categoryId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.categoryId, { categoriaId: t.categoryId, nome: t.category.nome, total: t.valor });
    }
  }
  return [...totals.values()];
}

export type TransactionComConta = {
  valor: Prisma.Decimal;
  accountId: string;
  account: { nome: string };
};

export type FaturaPorCartao = { accountId: string; nome: string; total: Prisma.Decimal };

export function agruparFaturaAtualPorCartao(transactions: TransactionComConta[]): FaturaPorCartao[] {
  const totals = new Map<string, FaturaPorCartao>();
  for (const t of transactions) {
    const existing = totals.get(t.accountId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.accountId, { accountId: t.accountId, nome: t.account.nome, total: t.valor });
    }
  }
  return [...totals.values()];
}

export function mesParaIntervalo(mes: string): { inicio: Date; fim: Date } {
  const [ano, mesNumero] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mesNumero - 1, 1));
  const fim = new Date(Date.UTC(ano, mesNumero, 1));
  return { inicio, fim };
}

export function currentMonthUTC(): string {
  const hoje = new Date();
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type ExtratoFiltro = { mes: string; categoriaId?: string; accountId?: string };

export function construirFiltroExtrato(filtro: ExtratoFiltro): Prisma.TransactionWhereInput {
  const { inicio, fim } = mesParaIntervalo(filtro.mes);

  return {
    data: { gte: inicio, lt: fim },
    ...(filtro.categoriaId ? { categoryId: filtro.categoriaId } : {}),
    ...(filtro.accountId ? { accountId: filtro.accountId } : {}),
  };
}

export type TransactionComData = { valor: Prisma.Decimal; data: Date };

export type FaturaFutura = { mes: string; total: Prisma.Decimal };

export function agruparFaturasFuturas(transactions: TransactionComData[]): FaturaFutura[] {
  const totals = new Map<string, Prisma.Decimal>();
  for (const t of transactions) {
    const chave = `${t.data.getUTCFullYear()}-${String(t.data.getUTCMonth() + 1).padStart(2, '0')}`;
    totals.set(chave, (totals.get(chave) ?? new Prisma.Decimal(0)).plus(t.valor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({ mes, total }));
}

export function somarValores(transactions: { valor: Prisma.Decimal }[]): Prisma.Decimal {
  return transactions.reduce((soma, t) => soma.plus(t.valor), new Prisma.Decimal(0));
}

export function calcularLimiteDisponivel(input: {
  limite: Prisma.Decimal;
  faturaAtual: Prisma.Decimal;
  faturasFuturas: FaturaFutura[];
}): Prisma.Decimal {
  const totalComprometido = input.faturasFuturas.reduce(
    (soma, f) => soma.plus(f.total),
    input.faturaAtual,
  );
  return input.limite.minus(totalComprometido);
}
