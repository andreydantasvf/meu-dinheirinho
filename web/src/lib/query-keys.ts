export type ExtratoFilters = {
  mes: string;
  categoriaId?: string;
  accountId?: string;
};

export const queryKeys = {
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  transaction: (id: string) => ['transactions', id] as const,
  extrato: (filters: ExtratoFilters) => ['extrato', filters] as const,
  purchases: ['purchases'] as const,
  dashboard: (mes?: string) => ['dashboard', mes] as const,
  fatura: (accountId: string) => ['fatura', accountId] as const,
};
