import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Category } from '@/types/entities';

export type CategoryInput = {
  nome: string;
  tipo: Category['tipo'];
  icone?: string;
  cor?: string;
};

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<Category[]>('/categories'),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      apiFetch<Category>('/categories', { method: 'POST', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CategoryInput> & { id: string }) =>
      apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}
