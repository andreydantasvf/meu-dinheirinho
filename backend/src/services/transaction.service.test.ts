import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionRepository } from '../repositories/transaction.repository';
import { transactionService } from './transaction.service';

vi.mock('../repositories/transaction.repository', () => ({
  transactionRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('transactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() returns all transactions from the repository', async () => {
    const transactions = [
      {
        id: 't1',
        accountId: 'acc1',
        categoryId: 'cat1',
        valor: 100,
        descricao: 'Transação 1',
        data: new Date(),
        tipo: 'RECEITA' as const,
        purchaseId: null,
        parcelaNumero: null,
        parcelaTotal: null,
        createdAt: new Date(),
      },
    ];
    vi.mocked(transactionRepository.findAll).mockResolvedValue(transactions as never);

    const result = await transactionService.list();

    expect(result).toBe(transactions);
  });

  it('get() throws AppError 404 when the transaction does not exist', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue(null);

    await expect(transactionService.get('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('create() persists a standalone transaction via the repository', async () => {
    const data = {
      accountId: 'acc1',
      categoryId: 'cat1',
      valor: 100,
      descricao: 'Nova transação',
      data: new Date(),
      tipo: 'RECEITA' as const,
    };
    const createdTransaction = {
      id: 't1',
      ...data,
      purchaseId: null,
      parcelaNumero: null,
      parcelaTotal: null,
      createdAt: new Date(),
    };
    vi.mocked(transactionRepository.create).mockResolvedValue(createdTransaction as never);

    const result = await transactionService.create(data);

    expect(result).toBe(createdTransaction);
    expect(transactionRepository.create).toHaveBeenCalledWith(data);
  });

  it('update() succeeds for a standalone transaction (purchaseId is null)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: null,
    } as never);
    const updated = { id: 't1', descricao: 'Novo valor' };
    vi.mocked(transactionRepository.update).mockResolvedValue(updated as never);

    const result = await transactionService.update('t1', { descricao: 'Novo valor' });

    expect(result).toBe(updated);
    expect(transactionRepository.update).toHaveBeenCalledWith('t1', { descricao: 'Novo valor' });
  });

  it('update() throws AppError 400 for a parceled transaction (purchaseId set)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: 'purchase-1',
    } as never);

    await expect(transactionService.update('t1', { descricao: 'x' })).rejects.toMatchObject({
      status: 400,
    });
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it('remove() succeeds for a standalone transaction (purchaseId is null)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: null,
    } as never);

    await transactionService.remove('t1');

    expect(transactionRepository.remove).toHaveBeenCalledWith('t1');
  });

  it('remove() throws AppError 400 for a parceled transaction (purchaseId set)', async () => {
    vi.mocked(transactionRepository.findById).mockResolvedValue({
      id: 't1',
      purchaseId: 'purchase-1',
    } as never);

    await expect(transactionService.remove('t1')).rejects.toMatchObject({ status: 400 });
    expect(transactionRepository.remove).not.toHaveBeenCalled();
  });
});
