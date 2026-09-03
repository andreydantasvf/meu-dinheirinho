import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Purchase } from '@/types/entities';

export type PurchaseInput = {
  accountId: string;
  categoryId: string;
  valorTotal: string;
  descricao: string;
  dataCompra: string;
  numeroParcelas: number;
};

function invalidateAfterPurchaseChange(
  queryClient: ReturnType<typeof useQueryClient>,
  accountId?: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.purchases });
  queryClient.invalidateQueries({ queryKey: ['extrato'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  if (accountId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.fatura(accountId) });
  }
}

export function usePurchases() {
  return useQuery({
    queryKey: queryKeys.purchases,
    queryFn: () => apiFetch<Purchase[]>('/purchases'),
  });
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: ['purchases', id],
    queryFn: () => apiFetch<Purchase>(`/purchases/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseInput) =>
      apiFetch<Purchase>('/purchases', { method: 'POST', body: input }),
    onSuccess: (_data, variables) =>
      invalidateAfterPurchaseChange(queryClient, variables.accountId),
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: PurchaseInput & { id: string }) =>
      apiFetch<Purchase>(`/purchases/${id}`, { method: 'PUT', body: input }),
    onSuccess: (_data, variables) =>
      invalidateAfterPurchaseChange(queryClient, variables.accountId),
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; accountId?: string }) =>
      apiFetch<void>(`/purchases/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, variables) =>
      invalidateAfterPurchaseChange(queryClient, variables.accountId),
  });
}
