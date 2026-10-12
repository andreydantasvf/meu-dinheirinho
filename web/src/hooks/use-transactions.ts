import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys, type ExtratoFilters } from '@/lib/query-keys';
import type { Transaction } from '@/types/entities';

export type TransactionInput = {
  accountId: string;
  categoryId: string;
  valor: string;
  descricao: string;
  data: string;
  tipo: Transaction['tipo'];
};

// Invalida a fatura de todos os cartões (não só a do `accountId` enviado):
// uma edição pode mover a transação de um cartão para outro. Também invalida o
// detalhe da transação, senão reabrir o formulário mostra o dado antigo do cache.
export function invalidateAfterTransactionChange(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['extrato'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['fatura'] });
}

export function useExtrato(filters: ExtratoFilters) {
  const params = new URLSearchParams({ mes: filters.mes });
  if (filters.categoriaId) params.set('categoriaId', filters.categoriaId);
  if (filters.accountId) params.set('accountId', filters.accountId);

  return useQuery({
    queryKey: queryKeys.extrato(filters),
    queryFn: () => apiFetch<Transaction[]>(`/extrato?${params.toString()}`),
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.transaction(id ?? ''),
    queryFn: () => apiFetch<Transaction>(`/transactions/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionInput) =>
      apiFetch<Transaction>('/transactions', { method: 'POST', body: input }),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: Partial<TransactionInput> & { id: string }) =>
      apiFetch<Transaction>(`/transactions/${id}`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
  });
}
