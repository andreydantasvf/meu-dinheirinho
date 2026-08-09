import { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

function inicioFimMesAtual() {
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  return { inicio, fim };
}

export const reportsRepository = {
  findTransactionsDoMesAtual() {
    const { inicio, fim } = inicioFimMesAtual();
    return prisma.transaction.findMany({
      where: { data: { gte: inicio, lt: fim } },
      include: { category: true, account: true },
    });
  },

  findTransactionsPorFiltro(where: Prisma.TransactionWhereInput) {
    return prisma.transaction.findMany({ where, orderBy: { data: 'desc' } });
  },

  findTransactionsDoCartaoApartirDe(accountId: string, apartirDe: Date) {
    return prisma.transaction.findMany({
      where: { accountId, data: { gte: apartirDe } },
    });
  },
};
