import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';
import type { CreateFixedExpenseInput } from '../validators/fixed-expense.schema';

type GeneratedTransactionInput = {
  valor: Prisma.Decimal;
  data: Date;
};

export const fixedExpenseRepository = {
  findAll() {
    return prisma.fixedExpense.findMany();
  },

  findActive() {
    return prisma.fixedExpense.findMany({ where: { status: 'ACTIVE' } });
  },

  findById(id: string) {
    return prisma.fixedExpense.findUnique({ where: { id } });
  },

  createWithTransactions(data: CreateFixedExpenseInput, transactions: GeneratedTransactionInput[]) {
    return prisma.$transaction(async (tx) => {
      const fixedExpense = await tx.fixedExpense.create({ data });
      await tx.transaction.createMany({
        data: transactions.map((t) => ({
          accountId: data.accountId,
          categoryId: data.categoryId,
          valor: t.valor,
          descricao: data.descricao,
          data: t.data,
          tipo: 'DESPESA' as const,
          fixedExpenseId: fixedExpense.id,
        })),
      });
      return fixedExpense;
    });
  },

  cancelAndRemoveFutureTransactions(id: string, fromDate: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: {
          fixedExpenseId: id,
          data: { gte: fromDate },
        },
      });
      const fixedExpense = await tx.fixedExpense.update({
        where: { id },
        data: { status: 'CANCELED' },
      });
      return fixedExpense;
    });
  },

  addFutureTransactions(id: string, data: CreateFixedExpenseInput, transactions: GeneratedTransactionInput[]) {
    return prisma.transaction.createMany({
      data: transactions.map((t) => ({
        accountId: data.accountId,
        categoryId: data.categoryId,
        valor: t.valor,
        descricao: data.descricao,
        data: t.data,
        tipo: 'DESPESA' as const,
        fixedExpenseId: id,
      })),
    });
  },

  getLatestTransactionDate(id: string) {
    return prisma.transaction.findFirst({
      where: { fixedExpenseId: id },
      orderBy: { data: 'desc' },
      select: { data: true },
    });
  }
};
