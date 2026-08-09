import { beforeEach, describe, expect, it, vi } from 'vitest';
import { purchaseRepository } from '../repositories/purchase.repository';
import { AppError } from '../types/errors';
import { generateInstallments } from './purchase-installments';
import { purchaseService } from './purchase.service';

vi.mock('../repositories/purchase.repository', () => ({
  purchaseRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    createWithInstallments: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('./purchase-installments', () => ({
  generateInstallments: vi.fn(),
}));

describe('purchaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create() generates installments and persists the purchase with them', async () => {
    const input = {
      accountId: 'acc1',
      categoryId: 'cat1',
      valorTotal: 100,
      descricao: 'Notebook',
      dataCompra: new Date('2026-03-15'),
      numeroParcelas: 3,
    };
    const installments = [{ valor: 33.33, data: new Date('2026-03-15'), parcelaNumero: 1, parcelaTotal: 3 }];
    vi.mocked(generateInstallments).mockReturnValue(installments as never);
    const createdPurchase = { id: 'p1', ...input };
    vi.mocked(purchaseRepository.createWithInstallments).mockResolvedValue(createdPurchase as never);

    const result = await purchaseService.create(input);

    expect(generateInstallments).toHaveBeenCalledWith({
      valorTotal: input.valorTotal,
      numeroParcelas: input.numeroParcelas,
      dataCompra: input.dataCompra,
    });
    expect(purchaseRepository.createWithInstallments).toHaveBeenCalledWith(input, installments);
    expect(result).toBe(createdPurchase);
  });

  it('get() throws AppError 404 when the purchase does not exist', async () => {
    vi.mocked(purchaseRepository.findById).mockResolvedValue(null);

    await expect(purchaseService.get('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('remove() deletes the purchase when it exists', async () => {
    vi.mocked(purchaseRepository.findById).mockResolvedValue({ id: 'p1' } as never);

    await purchaseService.remove('p1');

    expect(purchaseRepository.remove).toHaveBeenCalledWith('p1');
  });

  it('remove() throws AppError 404 and does not call the repository when the purchase does not exist', async () => {
    vi.mocked(purchaseRepository.findById).mockResolvedValue(null);

    await expect(purchaseService.remove('missing')).rejects.toThrow(AppError);
    expect(purchaseRepository.remove).not.toHaveBeenCalled();
  });
});
