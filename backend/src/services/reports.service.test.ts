import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountRepository } from '../repositories/account.repository';
import { reportsRepository } from '../repositories/reports.repository';
import { Prisma } from '../generated/prisma';
import { reportsService } from './reports.service';

vi.mock('../repositories/reports.repository', () => ({
  reportsRepository: {
    findTransactionsNoIntervalo: vi.fn(),
    findTransactionsPorFiltro: vi.fn(),
    findTransactionsDoCartaoApartirDe: vi.fn(),
  },
}));

vi.mock('../repositories/account.repository', () => ({
  accountRepository: {
    findById: vi.fn(),
  },
}));

describe('reportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dashboard() aggregates saldo, gasto por categoria and fatura por cartão', async () => {
    vi.mocked(reportsRepository.findTransactionsNoIntervalo).mockResolvedValue([
      {
        tipo: 'RECEITA',
        valor: new Prisma.Decimal(1000),
        categoryId: 'cat-salario',
        category: { nome: 'Salário' },
        accountId: 'acc-corrente',
        account: { nome: 'Conta Corrente', tipo: 'CONTA_CORRENTE' },
      },
      {
        tipo: 'DESPESA',
        valor: new Prisma.Decimal(200),
        categoryId: 'cat-mercado',
        category: { nome: 'Mercado' },
        accountId: 'acc-cartao',
        account: { nome: 'Cartão Nubank', tipo: 'CARTAO_CREDITO' },
      },
    ] as never);

    const result = await reportsService.dashboard();

    expect(result.saldoMes.toString()).toBe('800');
    expect(result.gastoPorCategoria).toEqual([
      { categoriaId: 'cat-mercado', nome: 'Mercado', total: new Prisma.Decimal(200) },
    ]);
    expect(result.faturaAtualPorCartao).toEqual([
      { accountId: 'acc-cartao', nome: 'Cartão Nubank', total: new Prisma.Decimal(200) },
    ]);
  });

  it('dashboard(mes) aggregates the given month instead of the current one', async () => {
    vi.mocked(reportsRepository.findTransactionsNoIntervalo).mockResolvedValue([]);

    await reportsService.dashboard('2026-03');

    expect(reportsRepository.findTransactionsNoIntervalo).toHaveBeenCalledWith(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-04-01T00:00:00.000Z'),
    );
  });

  it('extrato() builds the where clause and delegates to the repository', async () => {
    const transactions = [{ id: 't1' }];
    vi.mocked(reportsRepository.findTransactionsPorFiltro).mockResolvedValue(transactions as never);

    const result = await reportsService.extrato({ mes: '2026-03' });

    expect(result).toBe(transactions);
    expect(reportsRepository.findTransactionsPorFiltro).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Object) }),
    );
  });

  it('fatura() throws AppError 404 when the account does not exist', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue(null);

    await expect(reportsService.fatura('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('fatura() throws AppError 400 when the account is not a credit card', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue({
      id: 'acc1',
      tipo: 'CONTA_CORRENTE',
    } as never);

    await expect(reportsService.fatura('acc1')).rejects.toMatchObject({ status: 400 });
  });

  it('fatura() computes limiteDisponivel from current and future invoices', async () => {
    vi.mocked(accountRepository.findById).mockResolvedValue({
      id: 'acc1',
      tipo: 'CARTAO_CREDITO',
      limite: new Prisma.Decimal(5000),
    } as never);

    const hoje = new Date();
    const mesAtual = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 10));
    const proximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 10));

    vi.mocked(reportsRepository.findTransactionsDoCartaoApartirDe).mockResolvedValue([
      { valor: new Prisma.Decimal(800), data: mesAtual },
      { valor: new Prisma.Decimal(1200), data: proximoMes },
    ] as never);

    const result = await reportsService.fatura('acc1');

    expect(result.faturaAtual.toString()).toBe('800');
    expect(result.limiteDisponivel.toString()).toBe('3000');
  });
});
