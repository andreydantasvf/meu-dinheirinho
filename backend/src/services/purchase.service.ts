import { purchaseRepository } from '../repositories/purchase.repository';
import { AppError } from '../types/errors';
import type { CreatePurchaseInput } from '../validators/purchase.schema';
import { generateInstallments } from './purchase-installments';

export const purchaseService = {
  list() {
    return purchaseRepository.findAll();
  },

  async get(id: string) {
    const purchase = await purchaseRepository.findById(id);
    if (!purchase) throw new AppError('Compra não encontrada', 404);
    return purchase;
  },

  create(data: CreatePurchaseInput) {
    const installments = generateInstallments({
      valorTotal: data.valorTotal,
      numeroParcelas: data.numeroParcelas,
      dataCompra: data.dataCompra,
    });
    return purchaseRepository.createWithInstallments(data, installments);
  },

  async update(id: string, data: CreatePurchaseInput) {
    await this.get(id); // Ensure exists
    const installments = generateInstallments({
      valorTotal: data.valorTotal,
      numeroParcelas: data.numeroParcelas,
      dataCompra: data.dataCompra,
    });
    return purchaseRepository.updateWithInstallments(id, data, installments);
  },

  async remove(id: string) {
    await this.get(id);
    return purchaseRepository.remove(id);
  },
};
