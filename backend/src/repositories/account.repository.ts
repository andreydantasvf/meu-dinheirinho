import { prisma } from '../lib/prisma';
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from '../validators/account.schema';

export const accountRepository = {
  findAll() {
    return prisma.account.findMany();
  },

  findById(id: string) {
    return prisma.account.findUnique({ where: { id } });
  },

  create(data: CreateAccountInput) {
    return prisma.account.create({ data });
  },

  update(id: string, data: UpdateAccountInput) {
    return prisma.account.update({ where: { id }, data });
  },

  async isInUse(id: string) {
    const where = { accountId: id };
    const [transactions, purchases, fixedExpenses] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.purchase.count({ where }),
      prisma.fixedExpense.count({ where }),
    ]);
    return transactions + purchases + fixedExpenses > 0;
  },

  remove(id: string) {
    return prisma.account.delete({ where: { id } });
  },
};
