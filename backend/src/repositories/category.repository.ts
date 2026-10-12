import { prisma } from '../lib/prisma';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/category.schema';

export const categoryRepository = {
  findAll() {
    return prisma.category.findMany();
  },

  findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  create(data: CreateCategoryInput) {
    return prisma.category.create({ data });
  },

  update(id: string, data: UpdateCategoryInput) {
    return prisma.category.update({ where: { id }, data });
  },

  async isInUse(id: string) {
    const where = { categoryId: id };
    const [transactions, purchases, fixedExpenses] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.purchase.count({ where }),
      prisma.fixedExpense.count({ where }),
    ]);
    return transactions + purchases + fixedExpenses > 0;
  },

  remove(id: string) {
    return prisma.category.delete({ where: { id } });
  },
};
