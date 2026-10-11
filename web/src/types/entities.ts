// Mirrors backend/prisma/schema.prisma and docs/api.md response shapes.
// Money fields (valor, valorTotal, limite, metaMensal, total, saldoMes, faturaAtual, limiteDisponivel)
// are Prisma Decimal serialized as strings — never numbers. Always format/parse via lib/money.ts.

export type CategoryType = 'RECEITA' | 'DESPESA';
export type AccountType = 'CONTA_CORRENTE' | 'DINHEIRO' | 'CARTAO_CREDITO';
export type TransactionType = 'RECEITA' | 'DESPESA';

export const accountTypeLabels: Record<AccountType, string> = {
  CONTA_CORRENTE: 'Conta corrente',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
};

export type Category = {
  id: string;
  nome: string;
  tipo: CategoryType;
  icone: string | null;
  cor: string | null;
  metaMensal: string | null;
};

export type Account = {
  id: string;
  nome: string;
  tipo: AccountType;
  limite: string | null;
  diaFechamento: number | null;
  diaVencimento: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string;
  valor: string;
  descricao: string;
  data: string;
  tipo: TransactionType;
  purchaseId: string | null;
  fixedExpenseId: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
  createdAt: string;
};

export type Purchase = {
  id: string;
  accountId: string;
  categoryId: string;
  valorTotal: string;
  descricao: string;
  dataCompra: string;
  numeroParcelas: number;
  createdAt: string;
};

export type DashboardData = {
  saldoMes: string;
  gastoPorCategoria: Array<{
    categoriaId: string;
    nome: string;
    total: string;
  }>;
  faturaAtualPorCartao: Array<{
    accountId: string;
    nome: string;
    total: string;
  }>;
};

export type FaturaData = {
  faturaAtual: string;
  faturasFuturas: Array<{ mes: string; total: string }>;
  limiteDisponivel: string;
};

export type ReminderTipo = 'ENTRADA' | 'SAIDA';
export type ReminderRecorrencia = 'MENSAL' | 'UNICO';

// Lembretes só notificam — nunca afetam saldo (ver docs/architecture.md).
export type Reminder = {
  id: string;
  titulo: string;
  tipo: ReminderTipo;
  valor: string | null;
  recorrencia: ReminderRecorrencia;
  diaDoMes: number | null;
  /** UTC midnight of the chosen calendar date — read with its UTC parts, not local time. */
  dataUnica: string | null;
  horario: string;
  diasAntecedencia: number;
  ativo: boolean;
  proximoDisparo: string | null;
  ultimoDisparo: string | null;
  fixedExpenseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderTestResult = {
  canais: Array<{
    canal: string;
    status: 'enviado' | 'falhou' | 'desativado';
    erro?: string;
  }>;
};

export type PushConfig = {
  enabled: boolean;
  publicKey: string | null;
};
