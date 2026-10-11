import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma';

export const reminderRepository = {
  findAll() {
    return prisma.reminder.findMany({
      orderBy: [{ ativo: 'desc' }, { proximoDisparo: 'asc' }],
    });
  },

  findById(id: string) {
    return prisma.reminder.findUnique({ where: { id } });
  },

  findDue(agora: Date) {
    return prisma.reminder.findMany({
      where: { ativo: true, proximoDisparo: { lte: agora } },
    });
  },

  create(data: Prisma.ReminderUncheckedCreateInput) {
    return prisma.reminder.create({ data });
  },

  update(id: string, data: Prisma.ReminderUncheckedUpdateInput) {
    return prisma.reminder.update({ where: { id }, data });
  },

  markDispatched(id: string, ultimoDisparo: Date, proximoDisparo: Date | null) {
    return prisma.reminder.update({
      where: { id },
      data: { ultimoDisparo, proximoDisparo },
    });
  },

  deactivateByFixedExpense(fixedExpenseId: string) {
    return prisma.reminder.updateMany({
      where: { fixedExpenseId },
      data: { ativo: false },
    });
  },

  remove(id: string) {
    return prisma.reminder.delete({ where: { id } });
  },
};
