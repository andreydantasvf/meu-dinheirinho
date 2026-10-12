import Decimal from 'decimal.js';
import type { Transaction } from '@/types/entities';
import { DemoHttpError, internalError, invalid } from '../errors';
import {
  agruparFaturaAtualPorCartao,
  agruparFaturasFuturas,
  agruparGastoPorCategoria,
  agruparTerceiros,
  calcularLimiteDisponivel,
  calcularSaldoMes,
  currentMonthUTC,
  mesParaIntervalo,
  somarValores,
} from '../logic/report-calculations';
import type { Route } from '../router';
import type { DemoDb } from '../types';
import { findOr404 } from './shared';

// Espelha backend/src/{services/reports.service,validators/reports.schema}.ts.

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMes(value: string | null): string {
  if (value === null || !MES.test(value)) throw invalid();
  return value;
}

function noIntervalo(t: Transaction, inicio: Date, fim: Date): boolean {
  const data = new Date(t.data);
  return data >= inicio && data < fim;
}

// O include { category, account } do reportsRepository.
function comRelacoes(db: DemoDb) {
  const accounts = new Map(db.accounts.map((a) => [a.id, a]));
  const categories = new Map(db.categories.map((c) => [c.id, c]));
  return (t: Transaction) => {
    const account = accounts.get(t.accountId);
    const category = categories.get(t.categoryId);
    if (!account || !category) throw internalError();
    return {
      tipo: t.tipo,
      valor: new Decimal(t.valor),
      accountId: t.accountId,
      categoryId: t.categoryId,
      terceiro: t.terceiro,
      account,
      category,
    };
  };
}

function dashboard(db: DemoDb, query: URLSearchParams) {
  const mesParam = query.get('mes');
  const mes = mesParam === null ? currentMonthUTC() : parseMes(mesParam);
  const { inicio, fim } = mesParaIntervalo(mes);
  const transactions = db.transactions
    .filter((t) => noIntervalo(t, inicio, fim))
    .map(comRelacoes(db));
  // Compras de terceiros entram na fatura do cartão, mas não no saldo/gasto.
  const minhas = transactions.filter((t) => !t.terceiro);

  return {
    saldoMes: calcularSaldoMes(minhas).toString(),
    gastoPorCategoria: agruparGastoPorCategoria(
      minhas.filter((t) => t.tipo === 'DESPESA'),
    ).map((g) => ({ ...g, total: g.total.toString() })),
    faturaAtualPorCartao: agruparFaturaAtualPorCartao(
      transactions.filter((t) => t.account.tipo === 'CARTAO_CREDITO'),
    ).map((f) => ({ ...f, total: f.total.toString() })),
  };
}

function extrato(db: DemoDb, query: URLSearchParams): Transaction[] {
  const { inicio, fim } = mesParaIntervalo(parseMes(query.get('mes')));
  const categoriaId = query.get('categoriaId') || undefined;
  const accountId = query.get('accountId') || undefined;
  return db.transactions
    .filter(
      (t) =>
        noIntervalo(t, inicio, fim) &&
        (!categoriaId || t.categoryId === categoriaId) &&
        (!accountId || t.accountId === accountId),
    )
    .sort((a, b) => b.data.localeCompare(a.data));
}

function fatura(db: DemoDb, accountId: string) {
  const account = findOr404(db.accounts, accountId, 'Conta não encontrada');
  if (account.tipo !== 'CARTAO_CREDITO') {
    throw new DemoHttpError(400, 'Conta não é um cartão de crédito');
  }

  const hoje = new Date();
  const inicioMesAtual = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1),
  );
  const inicioProximoMes = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1),
  );

  const transactions = db.transactions
    .filter(
      (t) => t.accountId === accountId && new Date(t.data) >= inicioMesAtual,
    )
    .map((t) => ({
      valor: new Decimal(t.valor),
      data: new Date(t.data),
      fixedExpenseId: t.fixedExpenseId,
      terceiro: t.terceiro,
    }));
  const doMesAtual = transactions.filter((t) => t.data < inicioProximoMes);
  const futuras = transactions.filter((t) => t.data >= inicioProximoMes);

  const faturaAtual = somarValores(doMesAtual);
  // Gastos fixos futuros não abatem o limite (docs/api.md, Fixed Expenses).
  const limiteDisponivel = calcularLimiteDisponivel({
    limite: new Decimal(account.limite ?? 0),
    faturaAtual,
    faturasFuturas: agruparFaturasFuturas(
      futuras.filter((t) => !t.fixedExpenseId),
    ),
  });

  return {
    faturaAtual: faturaAtual.toString(),
    faturasFuturas: agruparFaturasFuturas(futuras).map((f) => ({
      mes: f.mes,
      total: f.total.toString(),
    })),
    limiteDisponivel: limiteDisponivel.toString(),
    terceirosFaturaAtual: agruparTerceiros(doMesAtual).map((t) => ({
      nome: t.nome,
      total: t.total.toString(),
    })),
  };
}

export const reportRoutes: Route[] = [
  {
    method: 'GET',
    pattern: '/dashboard',
    handler: ({ db, query }) => dashboard(db, query),
  },
  {
    method: 'GET',
    pattern: '/extrato',
    handler: ({ db, query }) => extrato(db, query),
  },
  {
    method: 'GET',
    pattern: '/accounts/:id/fatura',
    handler: ({ db, params }) => fatura(db, params.id),
  },
];
