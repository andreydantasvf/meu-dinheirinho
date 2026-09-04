import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type CreateFixedExpensePayload = {
  accountId: string;
  categoryId: string;
  valor: number | string;
  descricao: string;
  dataInicio: string;
};

export function useCreateFixedExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFixedExpensePayload) => {
      return apiFetch('/fixed-expenses', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extrato'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // We should probably invalidate fatura too, wait, queryKeys.fatura(accountId)
      // For now just hardcoded invalidation is fine, or we can use queryKeys.
    },
  });
}

export function useDeleteFixedExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return apiFetch(`/fixed-expenses/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extrato'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
