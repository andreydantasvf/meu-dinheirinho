import { transactionRepository } from '../repositories/transaction.repository';
import { AppError } from '../types/errors';
import type { CreateTransactionInput, UpdateTransactionInput } from '../validators/transaction.schema';

export const transactionService = {
  list() {
    return transactionRepository.findAll();
  },

  async get(id: string) {
    const transaction = await transactionRepository.findById(id);
    if (!transaction) throw new AppError('Transação não encontrada', 404);
    return transaction;
  },

  create(data: CreateTransactionInput) {
    return transactionRepository.create(data);
  },

  async update(id: string, data: UpdateTransactionInput) {
    const transaction = await this.get(id);
    if (transaction.purchaseId) {
      throw new AppError('Transação de compra parcelada não pode ser editada diretamente', 400);
    }
    return transactionRepository.update(id, data);
  },

  async remove(id: string) {
    const transaction = await this.get(id);
    if (transaction.purchaseId) {
      throw new AppError('Transação de compra parcelada não pode ser editada diretamente', 400);
    }
    return transactionRepository.remove(id);
  },
};
