import Decimal from 'decimal.js';

// Port de backend/src/services/report-calculations.ts (Prisma.Decimal → decimal.js, que é a
// mesma lib por baixo). Mudou lá → espelhe aqui (docs/web-architecture.md#modo-demo).

export type TransactionForSaldo = {
  tipo: 'RECEITA' | 'DESPESA';
  valor: Decimal;
};

export function calcularSaldoMes(transactions: TransactionForSaldo[]): Decimal {
  return transactions.reduce((saldo, t) => {
    return t.tipo === 'RECEITA' ? saldo.plus(t.valor) : saldo.minus(t.valor);
  }, new Decimal(0));
}

export type TransactionComCategoria = {
  valor: Decimal;
  categoryId: string;
  category: { nome: string };
};

export type GastoPorCategoria = {
  categoriaId: string;
  nome: string;
  total: Decimal;
};

export function agruparGastoPorCategoria(
  transactions: TransactionComCategoria[],
): GastoPorCategoria[] {
  const totals = new Map<string, GastoPorCategoria>();
  for (const t of transactions) {
    const existing = totals.get(t.categoryId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.categoryId, {
        categoriaId: t.categoryId,
        nome: t.category.nome,
        total: t.valor,
      });
    }
  }
  return [...totals.values()];
}

export type TransactionComConta = {
  valor: Decimal;
  accountId: string;
  account: { nome: string };
};

export type FaturaPorCartao = {
  accountId: string;
  nome: string;
  total: Decimal;
};

export function agruparFaturaAtualPorCartao(
  transactions: TransactionComConta[],
): FaturaPorCartao[] {
  const totals = new Map<string, FaturaPorCartao>();
  for (const t of transactions) {
    const existing = totals.get(t.accountId);
    if (existing) {
      existing.total = existing.total.plus(t.valor);
    } else {
      totals.set(t.accountId, {
        accountId: t.accountId,
        nome: t.account.nome,
        total: t.valor,
      });
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

export type TransactionComData = { valor: Decimal; data: Date };

export type FaturaFutura = { mes: string; total: Decimal };

export function agruparFaturasFuturas(
  transactions: TransactionComData[],
): FaturaFutura[] {
  const totals = new Map<string, Decimal>();
  for (const t of transactions) {
    const chave = `${t.data.getUTCFullYear()}-${String(t.data.getUTCMonth() + 1).padStart(2, '0')}`;
    totals.set(chave, (totals.get(chave) ?? new Decimal(0)).plus(t.valor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({ mes, total }));
}

export function somarValores(transactions: { valor: Decimal }[]): Decimal {
  return transactions.reduce((soma, t) => soma.plus(t.valor), new Decimal(0));
}

export function calcularLimiteDisponivel(input: {
  limite: Decimal;
  faturaAtual: Decimal;
  faturasFuturas: FaturaFutura[];
}): Decimal {
  const totalComprometido = input.faturasFuturas.reduce(
    (soma, f) => soma.plus(f.total),
    input.faturaAtual,
  );
  return input.limite.minus(totalComprometido);
}

export type TransactionComTerceiro = {
  valor: Decimal;
  terceiro: string | null;
};

export type TotalPorTerceiro = { nome: string; total: Decimal };

export function agruparTerceiros(
  transactions: TransactionComTerceiro[],
): TotalPorTerceiro[] {
  const totals = new Map<string, Decimal>();
  for (const t of transactions) {
    if (!t.terceiro) continue;
    totals.set(
      t.terceiro,
      (totals.get(t.terceiro) ?? new Decimal(0)).plus(t.valor),
    );
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nome, total]) => ({ nome, total }));
}
