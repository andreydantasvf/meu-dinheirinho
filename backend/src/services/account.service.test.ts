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

    await expect(accountService.get('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('update() throws AppError 404 and does not call the repository when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.update('missing', { nome: 'x' })).rejects.toThrow(AppError);
    expect(accountRepository.update).not.toHaveBeenCalled();
  });

  it('remove() throws AppError 404 and does not call the repository when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(accountService.remove('missing')).rejects.toThrow(AppError);
    expect(accountRepository.remove).not.toHaveBeenCalled();
  });
});
