import { Prisma } from '../generated/prisma';
import { prisma } from '../lib/prisma';

export const reportsRepository = {
  findTransactionsNoIntervalo(inicio: Date, fim: Date) {
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
