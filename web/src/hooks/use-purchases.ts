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
  terceiro: string | null;
};

// Editar uma compra regenera as parcelas (transações) e pode trocar o cartão,
// então invalida o detalhe das transações e a fatura de todos os cartões, não
// só a do cartão novo.
function invalidateAfterPurchaseChange(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.purchases });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['extrato'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['fatura'] });
}

export function usePurchases() {
  return useQuery({
    queryKey: queryKeys.purchases,
    queryFn: () => apiFetch<Purchase[]>('/purchases'),
  });
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.purchase(id ?? ''),
    queryFn: () => apiFetch<Purchase>(`/purchases/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseInput) =>
      apiFetch<Purchase>('/purchases', { method: 'POST', body: input }),
    onSuccess: () => invalidateAfterPurchaseChange(queryClient),
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: PurchaseInput & { id: string }) =>
      apiFetch<Purchase>(`/purchases/${id}`, { method: 'PUT', body: input }),
    onSuccess: () => invalidateAfterPurchaseChange(queryClient),
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch<void>(`/purchases/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfterPurchaseChange(queryClient),
  });
}
