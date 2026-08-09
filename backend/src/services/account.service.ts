import { accountRepository } from '../repositories/account.repository';
import { AppError } from '../types/errors';
import type { CreateAccountInput, UpdateAccountInput } from '../validators/account.schema';

export const accountService = {
  list() {
    return accountRepository.findAll();
  },

  async get(id: string) {
    const account = await accountRepository.findById(id);
    if (!account) throw new AppError('Conta não encontrada', 404);
    return account;
  },

  create(data: CreateAccountInput) {
    return accountRepository.create(data);
  },

  async update(id: string, data: UpdateAccountInput) {
    await this.get(id);
    return accountRepository.update(id, data);
  },

  async remove(id: string) {
    await this.get(id);
    return accountRepository.remove(id);
  },
};
