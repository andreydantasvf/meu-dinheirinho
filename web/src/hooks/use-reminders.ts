import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type {
  Reminder,
  ReminderRecorrencia,
  ReminderTestResult,
  ReminderTipo,
} from '@/types/entities';

export type ReminderInput = {
  titulo: string;
  tipo: ReminderTipo;
  valor?: string | null;
  recorrencia: ReminderRecorrencia;
  diaDoMes?: number | null;
  /** "yyyy-MM-dd" */
  dataUnica?: string | null;
  horario?: string;
  diasAntecedencia?: number;
  ativo?: boolean;
  fixedExpenseId?: string | null;
};

export function useReminders() {
  return useQuery({
    queryKey: queryKeys.reminders,
    queryFn: () => apiFetch<Reminder[]>('/reminders'),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderInput) =>
      apiFetch<Reminder>('/reminders', { method: 'POST', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders }),
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ReminderInput> & { id: string }) =>
      apiFetch<Reminder>(`/reminders/${id}`, { method: 'PUT', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders }),
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/reminders/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders }),
  });
}

export function useTestReminder() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ReminderTestResult>(`/reminders/${id}/test`, { method: 'POST' }),
  });
}
