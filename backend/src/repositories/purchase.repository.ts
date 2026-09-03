import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';
import type { CreatePurchaseInput } from '../validators/purchase.schema';

type InstallmentInput = {
  valor: Prisma.Decimal;
  data: Date;
  parcelaNumero: number;
  parcelaTotal: number;
};

export const purchaseRepository = {
  findAll() {
    return prisma.purchase.findMany();
  },

  findById(id: string) {
    return prisma.purchase.findUnique({ where: { id } });
  },

  createWithInstallments(data: CreatePurchaseInput, installments: InstallmentInput[]) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({ data });
      await tx.transaction.createMany({
        data: installments.map((installment) => ({
          accountId: data.accountId,
          categoryId: data.categoryId,
          valor: installment.valor,
          descricao: data.descricao,
          data: installment.data,
          tipo: 'DESPESA' as const,
          purchaseId: purchase.id,
          parcelaNumero: installment.parcelaNumero,
          parcelaTotal: installment.parcelaTotal,
        })),
      });
      return purchase;
    });
  },

  updateWithInstallments(id: string, data: CreatePurchaseInput, installments: InstallmentInput[]) {
    return prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { purchaseId: id } });
      const purchase = await tx.purchase.update({ where: { id }, data });
      await tx.transaction.createMany({
        data: installments.map((installment) => ({
          accountId: data.accountId,
          categoryId: data.categoryId,
          valor: installment.valor,
          descricao: data.descricao,
          data: installment.data,
          tipo: 'DESPESA' as const,
          purchaseId: purchase.id,
          parcelaNumero: installment.parcelaNumero,
          parcelaTotal: installment.parcelaTotal,
        })),
      });
      return purchase;
    });
  },

  remove(id: string) {
    return prisma.$transaction([
      prisma.transaction.deleteMany({ where: { purchaseId: id } }),
      prisma.purchase.delete({ where: { id } }),
    ]);
  },
};
