import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { FaturaData } from '@/types/entities';

export function useFatura(accountId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.fatura(accountId ?? ''),
    queryFn: () => apiFetch<FaturaData>(`/accounts/${accountId}/fatura`),
    enabled: Boolean(accountId),
  });
}
