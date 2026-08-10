import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

type Category = { id: string; nome: string };

export default function Home() {
  // Deliberately hits a protected route (not /health, which is public) so this screen proves
  // the x-api-token round-trip end to end, not just that the API is reachable.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/categories'),
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Início</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {isLoading && 'Carregando...'}
        {isError && 'Não foi possível conectar à API'}
        {data && `${data.length} categoria(s) cadastrada(s)`}
      </p>
    </div>
  );
}
