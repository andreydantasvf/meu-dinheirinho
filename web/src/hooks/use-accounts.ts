import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Account } from '@/types/entities';

export type AccountInput = {
  nome: string;
  tipo: Account['tipo'];
  limite?: string;
  diaFechamento?: number;
  diaVencimento?: number;
};

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => apiFetch<Account[]>('/accounts'),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountInput) =>
      apiFetch<Account>('/accounts', { method: 'POST', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AccountInput> & { id: string }) =>
      apiFetch<Account>(`/accounts/${id}`, { method: 'PUT', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
  });
}
