import { Prisma } from '../generated/prisma/client.js';
import { accountRepository } from '../repositories/account.repository';
import { reportsRepository } from '../repositories/reports.repository';
import { AppError } from '../types/errors';
import {
  agruparFaturaAtualPorCartao,
  agruparFaturasFuturas,
  agruparGastoPorCategoria,
  agruparTerceiros,
  calcularLimiteDisponivel,
  calcularSaldoMes,
  construirFiltroExtrato,
  currentMonthUTC,
  mesParaIntervalo,
  somarValores,
  type ExtratoFiltro,
} from './report-calculations';

export const reportsService = {
  async dashboard(mes?: string) {
    const { inicio, fim } = mesParaIntervalo(mes ?? currentMonthUTC());
    const transactions = await reportsRepository.findTransactionsNoIntervalo(
      inicio,
      fim,
    );
    // Compras de terceiros entram na fatura do cartão, mas não no saldo/gasto.
    const minhas = transactions.filter((t) => !t.terceiro);
    const despesas = minhas.filter((t) => t.tipo === 'DESPESA');
    const doCartao = transactions.filter(
      (t) => t.account.tipo === 'CARTAO_CREDITO',
    );

    return {
      saldoMes: calcularSaldoMes(minhas),
      gastoPorCategoria: agruparGastoPorCategoria(despesas),
      faturaAtualPorCartao: agruparFaturaAtualPorCartao(doCartao),
    };
  },

  extrato(filtro: ExtratoFiltro) {
    const where = construirFiltroExtrato(filtro);
    return reportsRepository.findTransactionsPorFiltro(where);
  },

  async fatura(accountId: string) {
    const account = await accountRepository.findById(accountId);
    if (!account) throw new AppError('Conta não encontrada', 404);
    if (account.tipo !== 'CARTAO_CREDITO') {
      throw new AppError('Conta não é um cartão de crédito', 400);
    }

    const hoje = new Date();
    const inicioMesAtual = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1),
    );
    const inicioProximoMes = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1),
    );

    const transactions =
      await reportsRepository.findTransactionsDoCartaoApartirDe(
        accountId,
        inicioMesAtual,
      );
    const doMesAtual = transactions.filter((t) => t.data < inicioProximoMes);
    const futuras = transactions.filter((t) => t.data >= inicioProximoMes);

    const faturaAtual = somarValores(doMesAtual);
    const faturasFuturas = agruparFaturasFuturas(futuras);
    const futurasParaLimite = futuras.filter((t) => !t.fixedExpenseId);
    const faturasFuturasParaLimite = agruparFaturasFuturas(futurasParaLimite);

    const limiteDisponivel = calcularLimiteDisponivel({
      limite: account.limite ?? new Prisma.Decimal(0),
      faturaAtual,
      faturasFuturas: faturasFuturasParaLimite,
    });

    return {
      faturaAtual,
      faturasFuturas,
      limiteDisponivel,
      terceirosFaturaAtual: agruparTerceiros(doMesAtual),
    };
  },
};
