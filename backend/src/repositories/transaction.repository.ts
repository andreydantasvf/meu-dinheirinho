import { prisma } from '../lib/prisma';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.schema';

export const transactionRepository = {
  findAll() {
    return prisma.transaction.findMany();
  },

  findById(id: string) {
    return prisma.transaction.findUnique({ where: { id } });
  },

  create(data: CreateTransactionInput) {
    return prisma.transaction.create({ data });
  },

  update(id: string, data: UpdateTransactionInput) {
    return prisma.transaction.update({ where: { id }, data });
  },

  remove(id: string) {
    return prisma.transaction.delete({ where: { id } });
  },
};
