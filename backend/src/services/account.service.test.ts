import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountRepository } from '../repositories/account.repository';
import { AppError } from '../types/errors';
import { accountService } from './account.service';

vi.mock('../repositories/account.repository', () => ({
  accountRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() returns all accounts from the repository', async () => {
    const accounts = [{ id: '1', nome: 'Carteira' }];
    vi.mocked(accountRepository.findAll).mockResolvedValue(accounts as never);

    const result = await accountService.list();

    expect(result).toBe(accounts);
  });

  it('get() returns the account when it exists', async () => {
    const account = { id: '1', nome: 'Carteira' };
    vi.mocked(accountRepository.findById).mockResolvedValue(account as never);

    const result = await accountService.get('1');

    expect(result).toBe(account);
  });

  it('get() throws AppError 404 when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.get('missing')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('update() throws AppError 404 and does not call the repository when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(
      accountService.update('missing', { nome: 'x' }),
    ).rejects.toThrow(AppError);
    expect(accountRepository.update).not.toHaveBeenCalled();
  });

  it('remove() throws AppError 404 and does not call the repository when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.remove('missing')).rejects.toThrow(AppError);
    expect(accountRepository.remove).not.toHaveBeenCalled();
  });

  it('create() calls the repository and returns the created account', async () => {
    const data = {
      nome: 'Nubank',
      tipo: 'CARTAO_CREDITO' as const,
      limite: 5000,
      diaFechamento: 10,
      diaVencimento: 17,
    };
    const createdAccount = {
      id: '1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(accountRepository.create).mockResolvedValue(
      createdAccount as never,
    );

    const result = await accountService.create(data);

    expect(result).toBe(createdAccount);
    expect(accountRepository.create).toHaveBeenCalledWith(data);
  });

  it('update() updates the account when it exists', async () => {
    const existingAccount = {
      id: '1',
      nome: 'Old Name',
      tipo: 'DINHEIRO' as const,
    };
    const updateData = { nome: 'New Name' };
    const updatedAccount = { ...existingAccount, ...updateData };
    vi.mocked(accountRepository.findById).mockResolvedValue(
      existingAccount as never,
    );
    vi.mocked(accountRepository.update).mockResolvedValue(
      updatedAccount as never,
    );

    const result = await accountService.update('1', updateData);

    expect(result).toBe(updatedAccount);
    expect(accountRepository.update).toHaveBeenCalledWith('1', updateData);
  });

  it('remove() deletes the account when it exists', async () => {
    const existingAccount = {
      id: '1',
      nome: 'Carteira',
      tipo: 'DINHEIRO' as const,
    };
    vi.mocked(accountRepository.findById).mockResolvedValue(
      existingAccount as never,
    );
    vi.mocked(accountRepository.remove).mockResolvedValue(
      existingAccount as never,
    );

    await accountService.remove('1');

    expect(accountRepository.remove).toHaveBeenCalledWith('1');
  });
});
