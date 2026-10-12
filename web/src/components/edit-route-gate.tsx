import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ModalRoute } from './ModalRoute';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useCloseModal } from '@/hooks/use-close-modal';

// Gate das rotas de edição: só monta o formulário (via `children`) com o registro
// já carregado — ver docs/web-architecture.md sobre o race do Select controlado.
// Checa `data` e não `isLoading`: offline sem cache a query fica pending + paused,
// `isLoading` é false e o formulário abriria em branco como se fosse edição.
export function EditRouteGate<T>({
  title,
  notFoundMessage,
  query,
  children,
}: {
  title: string;
  notFoundMessage: string;
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  const closeModal = useCloseModal();

  if (query.data !== undefined) return children(query.data);

  const isOffline = !query.isError && query.fetchStatus === 'paused';
  const isLoading = !query.isError && !isOffline;
  const message = query.isError
    ? query.error instanceof ApiError && query.error.status === 404
      ? notFoundMessage
      : 'Não foi possível carregar os dados.'
    : isOffline
      ? 'Sem conexão. Este item não está disponível offline.'
      : 'Carregando...';

  return (
    <ModalRoute title={title}>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
        {!isLoading && (
          <div className="flex gap-2">
            {query.isError && (
              <Button variant="outline" onClick={() => query.refetch()}>
                Tentar de novo
              </Button>
            )}
            <Button variant="ghost" onClick={closeModal}>
              Voltar
            </Button>
          </div>
        )}
      </div>
    </ModalRoute>
  );
}
