import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCalendar, IconUser } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionRow } from '@/components/transaction-row';
import { DeleteTransactionDialog } from '@/components/delete-transaction-dialog';
import { useCategories } from '@/hooks/use-categories';
import { useFatura } from '@/hooks/use-fatura';
import { useExtrato } from '@/hooks/use-transactions';
import { apiStringToCents, centsToApiString, formatMoney } from '@/lib/money';
import { currentMonth, formatMonthLabel } from '@/lib/date';
import type { Account, Transaction } from '@/types/entities';

export function CardInvoiceDetails({ account }: { account: Account }) {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: fatura } = useFatura(account.id);
  const {
    data: items,
    isLoading,
    isError,
  } = useExtrato({ accountId: account.id, mes: currentMonth() });
  const [deleting, setDeleting] = useState<Transaction | undefined>(undefined);

  const categoryMap = useMemo(
    () => new Map(categories?.map((c) => [c.id, c])),
    [categories],
  );
  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => b.data.localeCompare(a.data)),
    [items],
  );

  const terceiros = fatura?.terceirosFaturaAtual ?? [];
  // "Seu gasto" = fatura atual menos o que é de terceiros, em centavos.
  const seuGastoCents = fatura
    ? terceiros.reduce(
        (cents, t) => cents - apiStringToCents(t.total),
        apiStringToCents(fatura.faturaAtual),
      )
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {terceiros.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Terceiros nesta fatura
          </span>
          <div className="flex flex-col gap-1.5">
            {terceiros.map((terceiro) => (
              <div
                key={terceiro.nome}
                className="flex justify-between gap-3 text-xs font-medium text-muted-foreground"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <IconUser size={13} className="shrink-0" />
                  <span className="truncate">{terceiro.nome}</span>
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatMoney(terceiro.total)}
                </span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-xs font-semibold text-foreground">
              <span>Seu gasto</span>
              <span className="font-extrabold tabular-nums">
                {formatMoney(centsToApiString(seuGastoCents))}
              </span>
            </div>
          </div>
        </div>
      )}

      {fatura && fatura.faturasFuturas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Faturas Futuras
          </span>
          <div className="flex flex-col gap-1.5">
            {fatura.faturasFuturas.map((future) => (
              <div
                key={future.mes}
                className="flex justify-between text-xs font-medium text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <IconCalendar size={13} className="text-muted-foreground" />
                  {formatMonthLabel(future.mes)}
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatMoney(future.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          Itens da fatura atual
        </span>

        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
            <Skeleton className="h-16 w-full rounded-2xl bg-foreground/5" />
          </div>
        )}

        {isError && (
          <p className="py-4 text-center text-sm font-medium text-destructive">
            Não foi possível carregar os itens da fatura.
          </p>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <p className="py-4 text-center text-sm font-medium text-muted-foreground">
            Nenhum lançamento nesta fatura ainda.
          </p>
        )}

        {sorted.length > 0 && (
          <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
            {sorted.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                category={categoryMap.get(transaction.categoryId)}
                account={account}
                onEdit={() =>
                  navigate(
                    transaction.purchaseId
                      ? `/compras/${transaction.purchaseId}`
                      : `/transacoes/${transaction.id}`,
                  )
                }
                onDelete={() => setDeleting(transaction)}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteTransactionDialog
        transaction={deleting}
        onClose={() => setDeleting(undefined)}
      />
    </div>
  );
}
