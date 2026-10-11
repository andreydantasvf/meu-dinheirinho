import { fixedExpenseRepository } from '../repositories/fixed-expense.repository';
import { reminderRepository } from '../repositories/reminder.repository';
import { AppError } from '../types/errors';
import type { CreateFixedExpenseInput } from '../validators/fixed-expense.schema';
import {
  generateFixedExpenseTransactions,
  addMonthsClamped,
} from './fixed-expense-generator';

const HORIZON_MONTHS = 12;

export const fixedExpenseService = {
  list() {
    return fixedExpenseRepository.findAll();
  },

  async get(id: string) {
    const fixedExpense = await fixedExpenseRepository.findById(id);
    if (!fixedExpense) throw new AppError('Despesa fixa não encontrada', 404);
    return fixedExpense;
  },

  create(data: CreateFixedExpenseInput) {
    // Generate transactions for the next HORIZON_MONTHS from dataInicio
    const transactions = generateFixedExpenseTransactions({
      valor: data.valor,
      dataInicio: data.dataInicio,
      quantidadeMeses: HORIZON_MONTHS,
    });
    return fixedExpenseRepository.createWithTransactions(data, transactions);
  },

  async remove(id: string) {
    await this.get(id);
    // Delete only future transactions and mark as canceled
    const today = new Date();
    // Normalize to UTC midnight
    const todayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const canceled =
      await fixedExpenseRepository.cancelAndRemoveFutureTransactions(
        id,
        todayUTC,
      );
    // Lembretes ligados a um gasto fixo cancelado não fazem mais sentido.
    await reminderRepository.deactivateByFixedExpense(id);
    return canceled;
  },

  async ensureHorizon() {
    const activeExpenses = await fixedExpenseRepository.findActive();
    const today = new Date();
    const targetDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + HORIZON_MONTHS, 1),
    );

    for (const expense of activeExpenses) {
      const latestResult =
        await fixedExpenseRepository.getLatestTransactionDate(expense.id);
      if (!latestResult) continue;

      const latestDate = latestResult.data;
      if (latestDate < targetDate) {
        // We need to generate more transactions
        let currentIterDate = addMonthsClamped(latestDate, 1);
        const newTransactions = [];

        while (currentIterDate <= targetDate) {
          newTransactions.push({
            valor: expense.valor,
            data: currentIterDate,
          });
          currentIterDate = addMonthsClamped(currentIterDate, 1);
        }

        if (newTransactions.length > 0) {
          await fixedExpenseRepository.addFutureTransactions(
            expense.id,
            {
              accountId: expense.accountId,
              categoryId: expense.categoryId,
              valor: Number(expense.valor),
              descricao: expense.descricao,
              dataInicio: expense.dataInicio,
            },
            newTransactions,
          );
        }
      }
    }
  },
};
