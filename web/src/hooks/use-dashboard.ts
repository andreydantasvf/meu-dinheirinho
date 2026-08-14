import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { DashboardData } from '@/types/entities';

export function useDashboard(mes?: string) {
  const query = mes ? `?mes=${mes}` : '';
  return useQuery({
    queryKey: queryKeys.dashboard(mes),
    queryFn: () => apiFetch<DashboardData>(`/dashboard${query}`),
  });
}
