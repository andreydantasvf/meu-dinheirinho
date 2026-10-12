import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { invalidateAfterTransactionChange } from './use-transactions';

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
      return apiFetch<{ id: string }>('/fixed-expenses', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => invalidateAfterTransactionChange(queryClient),
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
      invalidateAfterTransactionChange(queryClient);
      // Cancelar um gasto fixo desativa os lembretes ligados a ele no backend.
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}
